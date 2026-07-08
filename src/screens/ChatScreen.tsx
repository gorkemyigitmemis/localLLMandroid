import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { initLlama, LlamaContext } from 'llama.rn';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { MessageBubble, Message } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { performWebSearch } from '../utils/searchEngine';

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<{role: string, text: string}[]>([]);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  const SYSTEM_PROMPT = `Sen yardımsever, akıllı ve Türkçe konuşan bir asistansın. Eğer kullanıcının sorusu GÜNCEL BİLGİ, gerçek zamanlı veriler (örneğin fiyat, yeni çıkan telefon modelleri, güncel olaylar) gerektiriyorsa KESİNLİKLE şu formatta cevap ver: [SEARCH: aranacak kelime]
Örnek: [SEARCH: iPhone 17 Pro Max fiyatı]
Eğer soru arama gerektirmiyorsa, normal ve doğal bir şekilde Türkçe cevap ver. Lütfen gereksiz yere arama yapma.`;

  useEffect(() => {
    return () => {
      if (llamaContext) {
        llamaContext.release();
      }
    };
  }, [llamaContext]);

  const loadModel = async (modelPath: string) => {
    try {
      setLoadingText('Model belleğe alınıyor...');
      const context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 1,
      });
      setLlamaContext(context);
      setIsModelLoaded(true);
    } catch (error) {
      console.warn("Model yüklenemedi:", error);
      Alert.alert("Hata", "Model belleğe alınırken bir hata oluştu.");
    } finally {
      setIsModelLoading(false);
    }
  };

  const handleSelectModel = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });

      if (!res.name?.endsWith('.gguf')) {
        Alert.alert('Geçersiz Dosya', 'Lütfen .gguf uzantılı bir model dosyası seçin.');
        return;
      }

      setIsModelLoading(true);
      setLoadingText('Model kopyalanıyor (Bu işlem biraz sürebilir)...');

      const destPath = `${RNFS.DocumentDirectoryPath}/${res.name}`;
      const exists = await RNFS.exists(destPath);
      if (exists) {
        await RNFS.unlink(destPath);
      }

      await RNFS.copyFile(res.uri, destPath);
      await loadModel(destPath);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error(err);
        Alert.alert('Hata', 'Dosya seçilirken bir hata oluştu.');
      }
      setIsModelLoading(false);
    }
  };

  const buildPrompt = (history: {role: string, text: string}[]) => {
    let p = `System: ${SYSTEM_PROMPT}\n\n`;
    history.forEach(msg => {
      p += `${msg.role}: ${msg.text}\n`;
    });
    p += `Assistant:`;
    return p;
  };

  const generateResponse = async (history: {role: string, text: string}[], botMessageId: string) => {
    if (!llamaContext) return;
    
    let fullResponse = "";
    try {
      await llamaContext.completion(
        {
          prompt: buildPrompt(history),
          n_predict: 200,
          temperature: 0.3, 
        },
        (data) => {
          fullResponse += data.token;
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, text: fullResponse }
                : msg
            )
          );
        }
      );

      // Arama tag'ini kontrol et
      const searchMatch = fullResponse.match(/\[SEARCH:\s*(.*?)\]/i);
      if (searchMatch) {
        const query = searchMatch[1].trim();
        
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: `🔍 İnternette aranıyor: "${query}"...\n` }
              : msg
          )
        );

        const searchResults = await performWebSearch(query);
        
        const newHistory = [
          ...history,
          { role: 'Assistant', text: fullResponse },
          { role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nYukarıdaki güncel bilgilere dayanarak kullanıcının sorusunu Türkçe olarak detaylıca yanıtla. [SEARCH] etiketini tekrar KULLANMA.` }
        ];
        
        let finalResponse = "";
        await llamaContext.completion(
          {
            prompt: buildPrompt(newHistory),
            n_predict: 500,
            temperature: 0.5,
          },
          (data) => {
            finalResponse += data.token;
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === botMessageId
                  ? { ...msg, text: `🔍 Aranmış konu: "${query}"\n\n${finalResponse}` }
                  : msg
              )
            );
          }
        );
        
        setConversation([...newHistory, { role: 'Assistant', text: finalResponse }]);
      } else {
        setConversation([...history, { role: 'Assistant', text: fullResponse }]);
      }

    } catch (error) {
      console.error("LLaMA completion error:", error);
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: "Bir hata oluştu. Lütfen tekrar deneyin." }
            : msg
        )
      );
    }
  };

  const handleSend = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const currentHistory = [...conversation, { role: 'User', text }];
    setConversation(currentHistory);

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      text: 'Düşünüyor...',
      isUser: false,
    };
    setMessages((prev) => [...prev, botMessage]);

    await generateResponse(currentHistory, botMessageId);
    setIsStreaming(false);
  };

  if (!isModelLoaded) {
    return (
      <View style={styles.loadingContainer}>
        {isModelLoading ? (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </>
        ) : (
          <>
            <Text style={styles.welcomeText}>Yerel LLM Sohbetine Hoş Geldiniz</Text>
            <Text style={styles.subText}>Başlamak için cihazınızdan bir .gguf modeli seçin.</Text>
            <TouchableOpacity style={styles.button} onPress={handleSelectModel}>
              <Text style={styles.buttonText}>Model Seç (Import GGUF)</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFEFEF',
  },
  listContent: {
    paddingVertical: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

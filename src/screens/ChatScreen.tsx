import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { initLlama, LlamaContext } from 'llama.rn';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { MessageBubble, Message } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const currentStreamMessageId = useRef<string | null>(null);

  useEffect(() => {
    // Cleanup on unmount
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

      // Define destination path in Document directory
      const destPath = `${RNFS.DocumentDirectoryPath}/${res.name}`;

      // Check if it already exists, if so delete it or just use it
      const exists = await RNFS.exists(destPath);
      if (exists) {
        await RNFS.unlink(destPath);
      }

      // Copy file from URI to local documents
      await RNFS.copyFile(res.uri, destPath);

      // Initialize the model
      await loadModel(destPath);

    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled
      } else {
        console.error(err);
        Alert.alert('Hata', 'Dosya seçilirken bir hata oluştu.');
        setIsModelLoading(false);
      }
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

    const botMessageId = (Date.now() + 1).toString();
    currentStreamMessageId.current = botMessageId;

    const botMessage: Message = {
      id: botMessageId,
      text: '',
      isUser: false,
    };

    setMessages((prev) => [...prev, botMessage]);

    if (llamaContext) {
      try {
        await llamaContext.completion(
          {
            prompt: `User: ${text}\nAssistant:`,
            n_predict: 200,
            temperature: 0.7,
          },
          (data) => {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === currentStreamMessageId.current
                  ? { ...msg, text: msg.text + data.token }
                  : msg
              )
            );
          }
        );
      } catch (error) {
        console.error("LLaMA completion error:", error);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === currentStreamMessageId.current
              ? { ...msg, text: "Bir hata oluştu. Lütfen tekrar deneyin." }
              : msg
          )
        );
      }
    } else {
      mockStreamResponse();
    }

    setIsStreaming(false);
  };

  const mockStreamResponse = () => {
    const words = "Merhaba, ben yerel LLM asistanınızım. Size nasıl yardımcı olabilirim?".split(' ');
    let currentIndex = 0;

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          const word = words[currentIndex] + ' ';
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === currentStreamMessageId.current
                ? { ...msg, text: msg.text + word }
                : msg
            )
          );
          currentIndex++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
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

import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { initLlama, LlamaContext } from 'llama.rn';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const SYSTEM_PROMPT = `Sen yardımsever bir Türkçe asistan olan Aisistan'sın. KESİN KURALLAR:
1. Kullanıcının sorusu GÜNCEL BİLGİ veya internet gerektiriyorsa KESİNLİKLE VE SADECE şu formatta cevap ver: [SEARCH: aranacak kelime]
2. [SEARCH: kelime] yazdıktan sonra ASLA başka bir şey yazma, cümleyi uzatma.
3. ALIŞVERİŞ VE FİYAT KARŞILAŞTIRMASI: Eğer kullanıcı bir ürünün "en ucuz nerede" olduğunu veya "fiyatını" soruyorsa aramayı KESİNLİKLE şu formatta yap: [SEARCH: site:akakce.com ürün adı fiyat]
4. YER VE HARİTA YÖNLENDİRMESİ: Eğer kullanıcıya fiziksel bir mağaza (Vatan Bilgisayar, MediaMarkt vb.) öneriyorsan veya "nerede" sorusuna cevap veriyorsan, cevabının sonuna KESİNLİKLE şu linki ekle: [Haritada Gör](https://maps.google.com/?q=Mağaza+Adı)
5. Asla "Bilmiyorum" deme, anında [SEARCH: ...] kullan.

ÖRNEKLER:
Kullanıcı: iPhone 17 nerede en ucuza satılıyor?
Sen: [SEARCH: site:akakce.com iPhone 17 fiyat]

Kullanıcı: Galatasaray son maçını kimle oynadı?
Sen: [SEARCH: Galatasaray son maçı sonucu]`;

  useEffect(() => {
    loadHistory();
    return () => {
      if (llamaContext) {
        llamaContext.release();
      }
    };
  }, [llamaContext]);

  // Geçmişi kaydetme
  useEffect(() => {
    const saveState = async () => {
      try {
        await AsyncStorage.setItem('@messages', JSON.stringify(messages));
        await AsyncStorage.setItem('@conversation', JSON.stringify(conversation));
      } catch (e) {
        console.warn("Geçmiş kaydedilemedi", e);
      }
    };
    saveState();
  }, [messages, conversation]);

  const loadHistory = async () => {
    try {
      const savedMessages = await AsyncStorage.getItem('@messages');
      const savedConv = await AsyncStorage.getItem('@conversation');
      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedConv) setConversation(JSON.parse(savedConv));
    } catch (e) {
      console.warn("Geçmiş yüklenemedi", e);
    }
  };

  const clearHistory = () => {
    Alert.alert("Emin misiniz?", "Tüm sohbet geçmişi cihazınızdan kalıcı olarak silinecektir.", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => {
        setMessages([]);
        setConversation([]);
        await AsyncStorage.removeItem('@messages');
        await AsyncStorage.removeItem('@conversation');
      }}
    ]);
  };

  const loadModel = async (modelPath: string) => {
    try {
      setLoadingText('Model belleğe alınıyor...\n(Gemma 2B)');
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
      setLoadingText('Ağırlıklar Kopyalanıyor\n(Bu işlem biraz sürebilir)...');

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
    let p = `<start_of_turn>user\n${SYSTEM_PROMPT}<end_of_turn>\n`;
    history.forEach(msg => {
      if (msg.role === 'User') {
        p += `<start_of_turn>user\n${msg.text}<end_of_turn>\n`;
      } else if (msg.role === 'Assistant') {
        p += `<start_of_turn>model\n${msg.text}<end_of_turn>\n`;
      } else if (msg.role === 'System') {
        p += `<start_of_turn>user\n[GÜNCEL İNTERNET VERİSİ]: ${msg.text}\nYukarıdaki güncel verilere dayanarak kullanıcının son sorusunu doğal bir Türkçe ile yanıtla.<end_of_turn>\n`;
      }
    });
    p += `<start_of_turn>model\n`;
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
          <View style={styles.glassCard}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        ) : (
          <View style={styles.glassCard}>
            <Text style={styles.welcomeTitle}>Antigravity AI</Text>
            <Text style={styles.subText}>Cihazınızda çalışan, çevrimdışı ve gizlilik odaklı süper asistanınıza hoş geldiniz.</Text>
            <TouchableOpacity style={styles.premiumButton} onPress={handleSelectModel}>
              <Text style={styles.premiumButtonText}>GGUF Modeli Yükle</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gemma 2 Asistan</Text>
          <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>🗑️ Temizle</Text>
          </TouchableOpacity>
        </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS background
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(242, 242, 247, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  clearButton: {
    padding: 8,
    backgroundColor: '#FF3B3015',
    borderRadius: 20,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 15,
    paddingHorizontal: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000', // Modern Dark background
  },
  glassCard: {
    width: '85%',
    padding: 30,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  subText: {
    fontSize: 15,
    color: '#EBEBF590',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
  },
  premiumButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 20,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { initLlama, LlamaContext } from 'llama.rn';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageBubble, Message } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { performWebSearch } from '../utils/searchEngine';
import Tts from 'react-native-tts';

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<{role: string, text: string}[]>([]);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const flatListRef = useRef<FlatList>(null);

  const SYSTEM_PROMPT = `Sen 'Aisistan' adında gelişmiş bir yapay zeka asistanısın.

1. BİLDİĞİN KONULAR: Tarih, nüfus, coğrafya, matematik, kodlama gibi kalıcı bilgilere sahipsen DOĞRUDAN cevap ver. Kendi zekanı kullan!
2. BİLMEDİĞİN VEYA GÜNCEL KONULAR: Eğer kullanıcının sorusu "bugün, dün, 2024, maç, haber, fiyat" gibi güncel internet verisi gerektiriyorsa VEYA cevabı hiç bilmiyorsan, KESİNLİKLE VE SADECE şu formatta çıktı ver: [SEARCH: aranacak kelime]
3. ALIŞVERİŞ VE FİYAT: SADECE EĞER kullanıcı bir ürünün fiyatını soruyorsa: [SEARCH: cimri ürün adı fiyat] kullan. Gelen sonuçlardaki ucuz fiyatlar (Örn: 500 TL) kılıf veya taksit tutarı olabilir. Eğer asıl telefonun gerçekçi fiyatını bulamıyorsan, kullanıcıya 'Sadece kılıf fiyatları var, asıl fiyat henüz belli değil' şeklinde AÇIKLAMA YAP. Sadece link atıp susma!
4. HARİTA (YER): Kullanıcıya fiziksel bir mağaza/yer öneriyorsan link ver: [Haritada Gör](https://maps.google.com/?q=Yer+Adı)
5. LİNKLER: Arama sonuçlarında sana sağlanan (URL) adreslerini KESİNLİKLE kullanarak tıklanabilir linkler oluştur. Format: [Site Adı](URL)
6. [SEARCH: ...] kullandığında yanına veya sonuna ASLA başka bir kelime yazma.

Örnekler:
Kullanıcı: Türkiye'nin nüfusu kaç?
Aisistan: Türkiye'nin nüfusu yaklaşık 85 milyondur. (Arama yapma)

Kullanıcı: iPhone 17 çıkış tarihi nedir?
Aisistan: [SEARCH: iPhone 17 çıkış tarihi]

Kullanıcı: Samsung S24 fiyatı ne kadar?
Aisistan: [SEARCH: cimri Samsung S24 fiyat]`;

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadHistory();
    try {
      Tts.getInitStatus().then(() => {
        Tts.setDefaultLanguage('tr-TR');
        Tts.setDefaultRate(0.5);
      }).catch(err => {
        if (err.code === 'no_engine') {
          Tts.requestInstallEngine();
        }
      });
    } catch (e) {
      console.warn("TTS initialization error", e);
    }
    
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
    let lastUpdate1 = Date.now();
    try {
      await llamaContext.completion(
        {
          prompt: buildPrompt(history),
          n_predict: 200,
          temperature: 0.3, 
        },
        (data) => {
          fullResponse += data.token;
          const now = Date.now();
          if (now - lastUpdate1 > 80) {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === botMessageId
                  ? { ...msg, text: fullResponse }
                  : msg
              )
            );
            lastUpdate1 = now;
          }
        }
      );
      
      // Ensure final flush
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: fullResponse }
            : msg
        )
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
          { role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nYukarıdaki güncel arama verilerine dayanarak soruyu Türkçe yanıtla. ÖNEMLİ KURALLAR:\n1. Kaynaklarda belirtilen (URL) adreslerini kullanarak [Site Adı](URL) formatında tıklanabilir linkler oluştur.\n2. Fiyat soruluyorsa, arama sonuçlarındaki aşırı ucuz fiyatların (Örn: 500 TL) telefon kılıfı olabileceğini unutma. Eğer asıl ürünün gerçek fiyatını bulamıyorsan, kullanıcıya 'Sadece kılıf/aksesuar fiyatları bulabildim, asıl cihazın fiyatı henüz belli değil veya çıkmamış olabilir' şeklinde SÖZEL BİR AÇIKLAMA YAP. Sadece link atıp susma.\n3. [SEARCH] etiketini tekrar KULLANMA.` }
        ];
        
        let finalResponse = "";
        let lastUpdate2 = Date.now();
        await llamaContext.completion(
          {
            prompt: buildPrompt(newHistory),
            n_predict: 500,
            temperature: 0.5,
          },
          (data) => {
            finalResponse += data.token;
            const now = Date.now();
            if (now - lastUpdate2 > 80) {
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: `🔍 Aranmış konu: "${query}"\n\n${finalResponse}` }
                    : msg
                )
              );
              lastUpdate2 = now;
            }
          }
        );
        
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: `🔍 Aranmış konu: "${query}"\n\n${finalResponse}` }
              : msg
          )
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
      <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
        {isModelLoading ? (
          <View style={styles.glassCard}>
            <BlurView style={StyleSheet.absoluteFill} blurType={isDark ? "dark" : "light"} blurAmount={25} />
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>{loadingText}</Text>
          </View>
        ) : (
          <View style={styles.glassCard}>
            <BlurView style={StyleSheet.absoluteFill} blurType={isDark ? "dark" : "light"} blurAmount={25} />
            <Text style={[styles.welcomeTitle, isDark && styles.welcomeTitleDark]}>Aisistan</Text>
            <Text style={[styles.subText, isDark && styles.subTextDark]}>Cihazınızda çalışan, çevrimdışı ve gizlilik odaklı süper asistanınıza hoş geldiniz.</Text>
            <TouchableOpacity style={styles.premiumButton} onPress={handleSelectModel}>
              <Text style={styles.premiumButtonText}>GGUF Modeli Yükle</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={[styles.header, isDark && styles.headerDark]}>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Aisistan</Text>
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
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  safeAreaDark: {
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: 'rgba(242, 242, 247, 0.9)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomColor: '#2C2C2E',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerTitleDark: {
    color: '#F2F2F7',
  },
  clearButton: {
    padding: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EFEFEF', 
  },
  loadingContainerDark: {
    backgroundColor: '#000000',
  },
  glassCard: {
    width: '85%',
    padding: 30,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  welcomeTitleDark: {
    color: '#FFFFFF',
  },
  subText: {
    fontSize: 15,
    color: '#3A3A3C',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  subTextDark: {
    color: '#EBEBF590',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingTextDark: {
    color: '#FFFFFF',
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

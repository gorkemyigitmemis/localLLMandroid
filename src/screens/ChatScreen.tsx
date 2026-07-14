import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert, useColorScheme, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import { initLlama, LlamaContext } from 'llama.rn';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageBubble, Message } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { performWebSearch } from '../utils/searchEngine';
import { scrapeWebsite, chunkAndRetrieve } from '../utils/ragAgent';
import { saveToMemory, searchMemory } from '../utils/localMemory';
import Tts from 'react-native-tts';

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<{role: string, text: string}[]>([]);
  const [persona, setPersona] = useState('');
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const flatListRef = useRef<FlatList>(null);

  const SYSTEM_PROMPT = `Sen 'Aisistan' adında gelişmiş bir yapay zeka asistanısın.

GÜNCEL VERİ VE BİLGİ İHTİYACINDA AŞAĞIDAKİ ARAÇLARI (TOOLS) KULLAN:
1. ARAMA YAPMAK İÇİN: Eğer kullanıcının sorusu "bugün, 2024, fiyat, hava durumu" gibi güncel veri gerektiriyorsa SADECE şu formatta çıktı ver:
{"action": "search", "query": "aranacak kelime"}

2. SİTE OKUMAK İÇİN: Eğer detaylı bir metin, haber, wikipedia okuman gerekiyorsa veya arama sonucundaki bir siteye girip içeriğini kazıman gerekiyorsa şu JSON'u döndür:
{"action": "read_site", "url": "https://..."}

3. TELEFON YÖNETİMİ İÇİN (SYSTEM INTENT): Eğer kullanıcı birini aramak, mesaj atmak, web sitesi açmak veya telefonun bir yerel özelliğini kullanmak istiyorsa şu formatta çıktı ver:
{"action": "intent", "url": "sms:1234567890"} veya {"action": "intent", "url": "tel:1234567890"} veya {"action": "intent", "url": "https://..."}

4. GEÇMİŞİ VE YEREL HAFIZAYI TARAMAK İÇİN: Kullanıcı geçmişte öğrettiği bir bilgiyi, okuttuğu bir siteyi veya pdf'i sorarsa yerel hafızanı (SSD) taramak için şu komutu ver:
{"action": "search_memory", "query": "aranacak kelime"}

KURALLAR:
1. JSON döndürdüğünde başka HİÇBİR metin yazma.
2. Eğer araçlardan gelen veriyi aldıysan DOĞRUDAN doğal dille Türkçe cevap ver.
3. Fiyat soruluyorsa: {"action": "search", "query": "cimri ürün adı fiyat"}
4. Hava durumu soruluyorsa: {"action": "search", "query": "Şehir Adı 20 Temmuz hava durumu derece"}
5. Harita önermek için markdown link kullan: [Haritada Gör](https://maps.google.com/?q=Yer+Adı)
6. Fotoğraf Analizi (Vision): Eğer sana bir [RESİM] tagi veya base64 verisi gelirse, o görseli dikkatlice inceleyip detaylı cevap ver.

Örnekler:
Kullanıcı: Türkiye'nin nüfusu kaç?
Aisistan: Türkiye'nin nüfusu yaklaşık 85 milyondur.

Kullanıcı: Ankara'da hava nasıl?
Aisistan: {"action": "search", "query": "Ankara hava durumu bugün derece"}

Kullanıcı: Wikipedia'dan karadelikler sayfasına bakıp özetle.
Aisistan: {"action": "read_site", "url": "https://tr.wikipedia.org/wiki/Kara_delik"}`;

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
      const savedPersona = await AsyncStorage.getItem('@user_persona');
      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedConv) setConversation(JSON.parse(savedConv));
      if (savedPersona) setPersona(savedPersona);
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
    let p = `<start_of_turn>user\n${SYSTEM_PROMPT}`;
    if (persona) {
      p += `\n\nKULLANICI ÇEKİRDEK HAFIZASI (Sohbet boyunca buna göre davran):\n${persona}`;
    }
    p += `<end_of_turn>\n`;
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
    
    let currentHistory = [...history];
    let finalResponse = "";
    const userQuery = history[history.length - 1].text;

    try {
      for (let step = 0; step < 3; step++) {
        let stepResponse = "";
        let lastUpdate = Date.now();
        
        await llamaContext.completion(
          {
            prompt: buildPrompt(currentHistory),
            n_predict: 800,
            temperature: 0.3, 
          },
          (data) => {
            stepResponse += data.token;
            const now = Date.now();
            if (now - lastUpdate > 80) {
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: stepResponse }
                    : msg
                )
              );
              lastUpdate = now;
            }
          }
        );
        
        // Ensure final flush
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: stepResponse }
              : msg
          )
        );

        // JSON aracı kontrolü
        const jsonMatch = stepResponse.match(/\{[\s\S]*"action"[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const actionData = JSON.parse(jsonMatch[0]);
            
            if (actionData.action === 'search' && actionData.query) {
              // Smart Query Pre-processing
              let finalQuery = actionData.query;
              const lowerQ = finalQuery.toLowerCase();
              if (lowerQ.includes('fiyat') || lowerQ.includes('kaç tl') || lowerQ.includes('ne kadar')) {
                finalQuery += ' site:cimri.com OR site:akakce.com';
              }
              if (lowerQ.includes('hava') || lowerQ.includes('bugün') || lowerQ.includes('şimdi')) {
                finalQuery += ` ${new Date().toLocaleDateString('tr-TR')}`;
              }

              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: `🔍 İnternette aranıyor: "${finalQuery}"...\n` }
                    : msg
                )
              );

              const searchResults = await performWebSearch(finalQuery);
              
              currentHistory = [
                ...currentHistory,
                { role: 'Assistant', text: stepResponse },
                { role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nYukarıdaki güncel arama verilerine dayanarak soruyu Türkçe yanıtla. ÖNEMLİ KURALLAR:\n1. Kaynaklarda belirtilen (URL) adreslerini kullanarak tıklanabilir linkler oluştur.\n2. Fiyat soruluyorsa, arama sonuçlarındaki aşırı ucuz fiyatların telefon kılıfı olabileceğini unutma.\n3. Gerekliyse {"action": "read_site", "url": "..."} aracıyla bir siteyi kazı.` }
              ];
              continue; // Ajan döngüye devam etsin
            } 
            else if (actionData.action === 'read_site' && actionData.url) {
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: `📖 Site okunuyor: ${actionData.url}...\n` }
                    : msg
                )
              );

              const rawText = await scrapeWebsite(actionData.url);
              const relevantChunk = chunkAndRetrieve(rawText, userQuery, 3); // Zero-RAM RAG
              
              // Hafızaya (SSD) kaydet
              await saveToMemory(actionData.url, relevantChunk);

              currentHistory = [
                ...currentHistory,
                { role: 'Assistant', text: stepResponse },
                { role: 'System', text: `[${actionData.url}] sitesinden senin için çekilen en ilgili metinler:\n\n${relevantChunk}\n\nBu metinleri okuyup analiz ederek kullanıcıya Markdown formatında şık ve detaylı bir cevap ver.` }
              ];
              continue; // Ajan döngüye devam etsin
            }
            else if (actionData.action === 'search_memory' && actionData.query) {
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: `🧠 Yerel hafıza taranıyor: "${actionData.query}"...\n` }
                    : msg
                )
              );

              const memoryResults = await searchMemory(actionData.query);
              
              currentHistory = [
                ...currentHistory,
                { role: 'Assistant', text: stepResponse },
                { role: 'System', text: `Yerel SSD hafızasından gelen sonuçlar:\n${memoryResults}\n\nEğer yeterliyse kullanıcıya cevap ver.` }
              ];
              continue;
            }
            else if (actionData.action === 'intent' && actionData.url) {
              setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: `📱 Sistem komutu çalıştırılıyor: ${actionData.url}...\n` }
                    : msg
                )
              );
              
              try {
                await Linking.openURL(actionData.url);
                currentHistory = [
                  ...currentHistory,
                  { role: 'Assistant', text: stepResponse },
                  { role: 'System', text: `Sistem komutu (${actionData.url}) başarıyla telefonda çalıştırıldı. Kullanıcıya işlemin yapıldığını söyle.` }
                ];
              } catch (err) {
                currentHistory = [
                  ...currentHistory,
                  { role: 'Assistant', text: stepResponse },
                  { role: 'System', text: `HATA: ${actionData.url} komutu telefonda çalıştırılamadı. Kullanıcıya bunu bildir.` }
                ];
              }
              continue;
            }
          } catch (e) {
            console.warn("JSON parse hatası, doğal dil olarak kabul ediliyor.");
          }
        }

        // Eğer JSON yoksa veya araç kullanılmadıysa, bu final cevaptır.
        finalResponse = stepResponse;
        break;
      }
      
      setConversation([...currentHistory, { role: 'Assistant', text: finalResponse }]);

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
    <View style={[styles.safeArea, isDark && styles.safeAreaDark]}>
      {/* Background Gradients for Glassmorphism */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.gradientCircle, styles.circle1]} />
        <View style={[styles.gradientCircle, styles.circle2]} />
        <BlurView style={StyleSheet.absoluteFill} blurType={isDark ? "dark" : "light"} blurAmount={30} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <View style={[styles.header, isDark && styles.headerDark]}>
            <BlurView style={StyleSheet.absoluteFill} blurType={isDark ? "dark" : "light"} blurAmount={20} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  safeAreaDark: {
    backgroundColor: '#050B14', // Midnight blue base for glass
  },
  gradientCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.3,
  },
  circle1: {
    top: -50,
    left: -100,
    backgroundColor: '#0284C7',
  },
  circle2: {
    bottom: '20%',
    right: -100,
    backgroundColor: '#3B82F6',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 229, 234, 0.3)',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerDark: {
    borderBottomColor: 'rgba(30, 41, 59, 0.5)',
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
    backgroundColor: '#0B1120',
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

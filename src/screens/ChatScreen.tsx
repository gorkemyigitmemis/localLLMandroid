import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator, TouchableOpacity, Alert, useColorScheme, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHeaderHeight } from '@react-navigation/elements';
import { getGlobalLlamaContext } from '../utils/llamaManager';
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
  
  const [isStreaming, setIsStreaming] = useState(false);
  const llamaContext = getGlobalLlamaContext();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const flatListRef = useRef<FlatList>(null);

  const SYSTEM_PROMPT = `Sen 'Aisistan' adında gelişmiş bir yapay zeka asistanısın.

GÜNCEL VERİ VE BİLGİ İHTİYACINDA AŞAĞIDAKİ ARAÇLARI (TOOLS) KULLAN:
1. ARAMA YAPMAK İÇİN: Kullanıcının sorusu spesifik bir cihaz, model, kişi, yer, fiyat, hava durumu veya güncel bilgi gerektiriyorsa SADECE şu formatta çıktı ver:
{"action": "search", "query": "aranacak kelime"}

2. SİTE OKUMAK İÇİN: Arama sonucundaki bir siteye girip içeriğini kazıman gerekiyorsa:
{"action": "read_site", "url": "https://..."}

3. TELEFON YÖNETİMİ İÇİN: Kullanıcı birini aramak, mesaj atmak, web sitesi açmak istiyorsa:
{"action": "intent", "url": "tel:1234567890"}

4. YEREL HAFIZAYI TARAMAK İÇİN: Kullanıcı daha önce öğrettiği bir bilgiyi sorarsa:
{"action": "search_memory", "query": "aranacak kelime"}

KURALLAR:
1. JSON döndürdüğünde başka HİÇBİR metin yazma.
2. BİLGİ BULDUKTAN SONRA: "Şu siteden bakabilirsiniz" DEME. TÜM BİLGİLERİ (özellikler, sayılar, fiyatlar) BİZZAT KENDİN MADDELER HALİNDE YAZ.
3. "Çok güçlü", "harika" gibi yuvarlak kelimeler kullanma. NET SAYI VE TEKNİK TERİM kullan (48 MP, 4500 mAh, 3.2 GHz gibi).
4. Harita için: [Haritada Gör](https://maps.google.com/?q=Yer+Adı)
5. "Bilmiyorum", "Erişimim kısıtlı" veya "Yardımcı olamam" demek KESİNLİKLE YASAKTIR. Bilgiyi bulana kadar arama ve site okuma (JSON) araçlarını kullanacaksın.

--- ÖRÜNTÜLER (Bu örneklere BIREBIR göre davran) ---

[HAVA DURUMU]
Kullanıcı: İstanbul'da hava nasıl?
Aisistan: {"action": "search", "query": "İstanbul hava durumu bugün sıcaklık derece"}
Kullanıcı: Ankara'da yarın yağmur var mı?
Aisistan: {"action": "search", "query": "Ankara yarın hava durumu yağmur"}

[TELEFON TEKNİK ÖZELLİKLERİ - HER MARKA İÇİN]
Kullanıcı: iPhone 17 Pro Max özellikleri neler?
Aisistan: {"action": "search", "query": "iPhone 17 Pro Max teknik özellikler işlemci kamera ekran batarya mAh"}
Kullanıcı: Samsung Galaxy S25 Ultra özellikleri?
Aisistan: {"action": "search", "query": "Samsung Galaxy S25 Ultra işlemci RAM ekran kamera batarya özellikleri"}
Kullanıcı: Xiaomi 15 Pro bataryası kaç mAh?
Aisistan: {"action": "search", "query": "Xiaomi 15 Pro teknik özellikler batarya mAh"}
Kullanıcı: Google Pixel 9 ekran boyutu?
Aisistan: {"action": "search", "query": "Google Pixel 9 ekran boyutu inç çözünürlük teknik özellikler"}

[ARAÇ TEKNİK ÖZELLİKLERİ]
Kullanıcı: BMW M5 özellikleri neler?
Aisistan: {"action": "search", "query": "BMW M5 2024 teknik özellikler beygir tork motor hacmi 0-100"}
Kullanıcı: Toyota Corolla motor hacmi kaç?
Aisistan: {"action": "search", "query": "Toyota Corolla 2024 motor hacmi beygir gücü tork teknik özellikler"}
Kullanıcı: Volkswagen Golf GTI kaç beygir?
Aisistan: {"action": "search", "query": "Volkswagen Golf GTI 2024 beygir gücü tork teknik özellikler"}

[FİYAT ARAŞTIRMA]
Kullanıcı: En ucuz iPhone 15 fiyatı nedir?
Aisistan: {"action": "search", "query": "iPhone 15 en ucuz fiyat site:cimri.com OR site:akakce.com"}
Kullanıcı: Samsung Galaxy S25 Türkiye fiyatı?
Aisistan: {"action": "search", "query": "Samsung Galaxy S25 fiyat TL site:cimri.com OR site:akakce.com"}
Kullanıcı: En uygun fiyatlı 5G telefon hangisi?
Aisistan: {"action": "search", "query": "en uygun fiyatlı 5G telefon 2024 karşılaştırma site:cimri.com"}

[NÜFUS / GÜNCEL İSTATİSTİK]
Kullanıcı: Türkiye'nin nüfusu kaç?
Aisistan: {"action": "search", "query": "Türkiye nüfusu 2024 TÜİK"}
Kullanıcı: Japonya nüfusu kaç?
Aisistan: {"action": "search", "query": "Japonya nüfusu 2024"}

[GENEL BİLGİ - arama gerekmez]
Kullanıcı: Amerika'nın başkenti neresi?
Aisistan: Amerika Birleşik Devletleri'nin başkenti Washington D.C.'dir.
Kullanıcı: Pi sayısı nedir?
Aisistan: Pi (π) sayısı yaklaşık 3.14159'dur.`;

  const headerHeight = useHeaderHeight();

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
  }, []);

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
    
    // RAM ve Token limitini korumak için sadece son 6 mesajı (3 diyalog) al
    let currentHistory = history.length > 6 ? history.slice(history.length - 6) : [...history];
    let finalResponse = "";
    const userQuery = history[history.length - 1].text.toLowerCase();

    // DENGELİ YÖNLENDİRİCİ (Sadece net veri/bilgi arayışlarında devreye girer, normal sohbeti bozmaz)
    const isDataQuery = /(hava durumu|kaç derece|nüfus|fiyat|özellikleri|teknik detay|kimdir|nedir|kaç beygir|motor hacmi|saat kaç)/i.test(userQuery);
    if (isDataQuery) {
        currentHistory.push({
            role: 'System', 
            text: `[ZORUNLU ARAMA] Bu soru güncel veya net bir bilgi (hava, nüfus, fiyat, özellik) gerektiriyor. Kendi bilgilerini kullanma, SADECE {"action": "search", "query": "..."} formatında yanıt ver!`
        });
    }

    try {
      for (let step = 0; step < 3; step++) {
        let stepResponse = "";
        let lastUpdate = Date.now();
        
        try {
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
        } catch (compErr: any) {
          // Only show the memory warning if nothing useful was generated.
          // Some llama.rn builds throw on successful completion — ignore those.
          const errMsg = String(compErr?.message || compErr || '');
          const isRealCrash = errMsg.includes('context') || errMsg.includes('kv') || errMsg.includes('OOM') || errMsg.includes('alloc');
          if (isRealCrash || stepResponse.trim().length === 0) {
            console.warn("LLM generation interrupted:", compErr);
            if (stepResponse.trim().length > 0) {
              // We have partial content — append a small note
              stepResponse += "\n\n_(Cevap kesilebilir — konuşmayı temizleyip tekrar deneyin.)_";
            } else {
              stepResponse = "Cevap üretilirken bir sorun oluştu. Sohbeti temizleyip tekrar deneyin.";
            }
          }
          // else: normal llama.rn completion signal, stepResponse is fine
        }
        
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
              if (lowerQ.includes('uçak') || lowerQ.includes('otobüs') || lowerQ.includes('bilet')) {
                finalQuery += ' site:obilet.com OR site:enuygun.com OR site:turna.com';
              } else if (lowerQ.includes('fiyat') || lowerQ.includes('kaç tl') || lowerQ.includes('ne kadar')) {
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
                { role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nÖNEMLİ GÖREV:\n1. Eğer sonuçlarda yeterli bilgi VARSA, bunları BİZZAT KENDİN MADDELER HALİNDE YAZ.\n2. Eğer bilgi YETERSİZSE, "bilmiyorum" veya "erişimim yok" demek KESİNLİKLE YASAKTIR! Bunun yerine SADECE şu formatta JSON döndürüp siteye girmelisin:\n{"action": "read_site", "url": "girmek_istediğin_link"}\n\nDİKKAT:\nCihaz veya araç özelliği listeliyorsan TÜRÜNE GÖRE ŞU FORMATLARI KULLAN:\n[TELEFON]: Ekran, İşlemci, Batarya, Kamera\n[ARABA]: Motor, Güç, Tork, Kapasite, 0-100\n[DİĞER CİHAZLAR]: En önemli 5 teknik veri.\nFiyatı da en alta ekle.` }
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
              
              let ragQuery = userQuery;
              if (/(özellik|telefon|araba|kamera|batarya|ekran|işlemci|motor|fiyat)/i.test(userQuery)) {
                  ragQuery += " işlemci batarya ekran kamera ram tork beygir güç kapasite mah mp hz çözünürlük";
              }
              const relevantChunk = chunkAndRetrieve(rawText, ragQuery, 4); // Reduced to 4 for fast mobile processing, magnetic query ensures accuracy
              
              // Hafızaya (SSD) kaydet
              await saveToMemory(actionData.url, relevantChunk);

              currentHistory = [
                ...currentHistory,
                { role: 'Assistant', text: stepResponse },
                { role: 'System', text: `[${actionData.url}] sitesinden en ilgili metinler:\n\n${relevantChunk}\n\nÖNEMLİ GÖREV: SAYISAL VERİLERİ koruyarak MADDELER HALİNDE ÖZETLE.\n\nCihaz özelliği listeliyorsan TÜRÜNE GÖRE ŞU FORMATLARI KULLAN:\n[TELEFON]: Ekran, İşlemci, Batarya, Kamera\n[ARABA]: Motor, Güç, Tork, Kapasite, 0-100\n[DİĞER]: En önemli 5 teknik veri.\nFiyatı da en alta ekle.` }
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
                { role: 'System', text: `Yerel SSD hafızasından gelen sonuçlar:\n${memoryResults}\n\nÖNEMLİ GÖREV: Bu hafıza sonuçlarını kullanarak BİZZAT KENDİN DETAYLI CEVAP VER. Link atıp geçmek yasaktır.` }
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

  return (
    <View style={[styles.safeArea, isDark && styles.safeAreaDark]}>
      {/* Background Gradients for Glassmorphism */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.gradientCircle, styles.circle1]} />
        <View style={[styles.gradientCircle, styles.circle2]} />
        <BlurView style={StyleSheet.absoluteFill} blurType={isDark ? "dark" : "light"} blurAmount={30} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
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
    paddingVertical: 8,
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

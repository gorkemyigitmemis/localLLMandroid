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

  const SYSTEM_PROMPT = `Sen kullanıcının yerel cihazında çalışan "Aisistan" adlı zekasın.

GÜNCEL BİLGİ/FİYAT İHTİYACINDA SADECE JSON ÇIKTISI VER:
{"action": "search", "query": "aranacak kelime"}

KURALLAR:
1. JSON döndürdüğünde başka HİÇBİR metin yazma.
Aisistan: Pi (π) sayısı yaklaşık 3.14159'dur.`;

  const headerHeight = useHeaderHeight();

  useEffect(() => {
    loadHistory();
    if (Platform.OS === 'ios') {
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
    let p = "";
    
    // Hafızayı 8 mesaja (4 soru-cevap) çıkarttık ki konu bütünlüğünü kaybetmesin
    const recentHistory = history.length > 8 ? history.slice(history.length - 8) : history;

    recentHistory.forEach((msg, index) => {
      let content = msg.text;
      
      // Sistem komutunu (SYSTEM_PROMPT) SADECE kullanıcının gönderdiği en son mesaja gizlice ekle
      if (index === recentHistory.length - 1 && msg.role === 'User') {
        content = `${SYSTEM_PROMPT}\n\nKULLANICI SORUSU:\n${msg.text}`;
        if (persona) content += `\n\nKULLANICI PROFİLİ:\n${persona}`;
      }

      if (msg.role === 'User') {
        p += `<start_of_turn>user\n${content}<end_of_turn>\n`;
      } else if (msg.role === 'Assistant') {
        p += `<start_of_turn>model\n${content}<end_of_turn>\n`;
      } else if (msg.role === 'System') {
        // Sistem verisini (arama sonuçlarını) user turn olarak yedir ki model görsün
        p += `<start_of_turn>user\n[GÜNCEL VERİ]: ${content}<end_of_turn>\n`;
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
    const isDataQuery = /(hava durumu|kaç derece|nüfus|fiyat|özellikleri|teknik detay|kimdir|nedir|kaç beygir|motor hacmi|saat kaç|uçak|otobüs|tren|feribot|bilet|kaç para|ne kadar)/i.test(userQuery);
    if (isDataQuery) {
        currentHistory.push({
            role: 'System', 
            text: `[ZORUNLU ARAMA] Bu soru güncel veya net bir bilgi (hava, nüfus, fiyat, bilet, özellik) gerektiriyor. Kendi bilgilerini kullanma, SADECE {"action": "search", "query": "..."} formatında yanıt ver!`
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
              // Smart Query Pre-processing with Fallback Safety
              let finalQuery = actionData.query;
              const lowerQ = finalQuery.toLowerCase();
              if (lowerQ.includes('hava') || lowerQ.includes('derece')) {
                finalQuery += ' bugün sıcaklık derece';
              } else if (lowerQ.includes('uçak') || lowerQ.includes('otobüs') || lowerQ.includes('bilet')) {
                finalQuery += ' site:obilet.com OR site:enuygun.com OR site:turna.com';
              } else if (lowerQ.includes('fiyat') || lowerQ.includes('kaç tl') || lowerQ.includes('ne kadar')) {
                finalQuery += ' site:cimri.com OR site:akakce.com';
              } else if (lowerQ.includes('özellik') || lowerQ.includes('işlemci') || lowerQ.includes('batarya') || lowerQ.includes('teknik detay')) {
                if (!lowerQ.includes('araba') && !lowerQ.includes('motor') && !lowerQ.includes('beygir')) {
                  finalQuery += ' site:epey.com';
                }
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
                { role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nÖNEMLİ GÖREV:\n1. Sonuçlardaki bilgileri (kaç derece, güneşli/yağmurlu, işlemci, fiyat vb.) KENDİN YAZ.\n2. KESİNLİKLE "şu linke gidin" veya "siteden bakabilirsiniz" DEME! Link verme.\n3. Cevabının en sonuna mutlaka: "Başka sormak veya merak ettiğiniz bir şey var mı?" diye ekle.` }
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
                { role: 'System', text: `[${actionData.url}] sitesinden en ilgili metinler:\n\n${relevantChunk}\n\nÖNEMLİ GÖREV: Sitedeki SAYISAL VERİLERİ ve teknik özellikleri koruyarak MADDELER HALİNDE YAZ. Sistem komutlarındaki şablonları ekrana kopyalama, sadece bulduğun gerçek verileri listele.` }
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

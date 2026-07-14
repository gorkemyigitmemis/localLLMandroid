import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { performWebSearch } from '../utils/searchEngine';
import { scrapeWebsite, chunkAndRetrieve } from '../utils/ragAgent';
import { saveToMemory, searchMemory } from '../utils/localMemory';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGlobalLlamaContext } from '../utils/llamaManager';

export const DeepThinkScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [persona, setPersona] = useState('');
  
  const llamaContext = getGlobalLlamaContext();
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadPersona = async () => {
      try {
        const savedPersona = await AsyncStorage.getItem('@user_persona');
        if (savedPersona) setPersona(savedPersona);
      } catch (e) {
        console.warn("Persona yüklenemedi", e);
      }
    };
    loadPersona();
  }, []);

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  const handleDeepThink = async () => {
    if (!llamaContext) {
      Alert.alert('Hata', 'Model yüklenmemiş.');
      return;
    }
    if (!query.trim()) return;

    setIsThinking(true);
    setLogs([]);
    setFinalReport(null);
    addLog('Derin düşünme protokolü başlatıldı...');
    
    const DEEP_THINK_PROMPT = `Sen Otonom bir Araştırmacı Ajansın. Görevin, kullanıcının verdiği karmaşık veya çok aşamalı istekleri mükemmel bir şekilde araştırmaktır.

Aşağıdaki ARAÇLARI (TOOLS) arka arkaya defalarca kullanarak araştırma yapmalısın. Aracı kullanmak için SADECE aşağıdaki JSON formatını yaz.

1. İNTERNETTE ARAMA YAPMAK İÇİN: (Fiyatlar, uçak biletleri, detaylı mekan veya gezi rotaları vs.)
{"action": "search", "query": "aranacak kelime"}

2. BİR SİTEYİ İNCELEMEK İÇİN: (Arama sonuçlarında çıkan detayları okumak için ZORUNLUDUR)
{"action": "read_site", "url": "https://..."}

3. KULLANICI HAFIZASINI TARAMAK İÇİN:
{"action": "search_memory", "query": "kelime"}

KURALLAR:
1. Araştırma yaparken (bilgi eksikken) ASLA normal metin yazma, sadece JSON araçlarını kullan.
2. TEK SEFERDE SADECE BİR ARAÇ (BİR JSON) KULLANABİLİRSİN. Birden fazla JSON bloğunu alt alta yazmak KESİNLİKLE YASAKTIR.
3. Kullanıcının BÜTÜN isteklerini (örneğin hem uçak fiyatlarını hem de detaylı gezi rotasını) bulmadan görevi bitirme.
4. Plan yapıyorsan "Kültürel bir yer gez" gibi baştan savma cevaplar KESİNLİKLE YASAKTIR. Net mekan adları, fiyatlar ve nokta atışı yerler vereceksin.
5. Tüm araştırman bittiğinde raporunu "SONUÇ:" kelimesiyle başlayarak Markdown olarak yaz.

${persona ? `KULLANICI ÇEKİRDEK HAFIZASI:\n${persona}` : ''}`;

    let currentHistory = [
      { role: 'System', text: DEEP_THINK_PROMPT },
      { role: 'user', text: query }
    ];

    let finalResponse = "";

    try {
      // Extended loop limit for Deep Think mode (10 iterations)
      for (let step = 1; step <= 8; step++) {
        addLog(`Adım ${step}: Model analiz yapıyor...`);
        let stepResponse = "";
        
        try {
          await llamaContext.completion(
            {
              prompt: buildPrompt(currentHistory),
              n_predict: 800,
              temperature: 0.2, 
            },
            (data) => {
              stepResponse += data.token;
            }
          );
        } catch (compErr) {
          console.warn("LLM generation interrupted:", compErr);
          stepResponse += "\n[Sistem Uyarı: Modelin işlem hafızası doldu, yanıt yarıda kesildi.]";
        }

        const jsonMatch = stepResponse.match(/\{[^{}]*"action"[^{}]*\}/);
        
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
              if (lowerQ.includes('hava') || lowerQ.includes('bugün')) {
                finalQuery += ` ${new Date().toLocaleDateString('tr-TR')}`;
              }

              addLog(`Araç tetiklendi: Web Arama -> "${finalQuery}"`);
              const searchResults = await performWebSearch(finalQuery);
              addLog(`Arama sonuçları başarıyla çekildi. (${searchResults.length} karakter)`);
              
              currentHistory.push({ role: 'Assistant', text: stepResponse });
              currentHistory.push({ role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nÖNEMLİ GÖREV:\n1. Eğer sonuçlarda yeterli bilgi VARSA, bunları BİZZAT KENDİN RAPORLA.\n2. Eğer bilgi YETERSİZSE, linkteki detayları okumak ZORUNDASIN. Siteyi okumak için SADECE şu formatta JSON döndür:\n{"action": "read_site", "url": "girmek_istediğin_link"}\n\nDİKKAT: Kullanıcıya asla link verip geçme!` });
              continue;
            } 
            else if (actionData.action === 'read_site' && actionData.url) {
              addLog(`Araç tetiklendi: Site Kazıma -> "${actionData.url}"`);
              const rawText = await scrapeWebsite(actionData.url);
              const relevantChunk = chunkAndRetrieve(rawText, query, 10);
              
              // Hafızaya (SSD) kaydet
              await saveToMemory(actionData.url, relevantChunk);

              addLog(`Siteden en uygun veri parçaları koparıldı ve diske kaydedildi. (${relevantChunk.length} karakter)`);

              currentHistory.push({ role: 'Assistant', text: stepResponse });
              currentHistory.push({ role: 'System', text: `[${actionData.url}] içerik özeti:\n${relevantChunk}\n\nÖNEMLİ GÖREV: Bu verilerdeki SAYISAL BİLGİLERİ, TEKNİK TERİMLERİ ve NET FİYATLARI koruyarak detaylı bir rapor sun. 'Çok iyi', 'harika' gibi yuvarlak kelimeler kullanma, analitik ol. 'Şu linke bak' demek YASAKTIR. Eğer araştırma bittiyse nihai raporunu SONUÇ: tagi ile yaz.` });
              continue;
            }
            else if (actionData.action === 'search_memory' && actionData.query) {
              addLog(`Araç tetiklendi: SSD Yerel Hafıza Tarama -> "${actionData.query}"`);
              const memoryResults = await searchMemory(actionData.query);
              addLog(`Hafıza taraması bitti.`);
              
              currentHistory.push({ role: 'Assistant', text: stepResponse });
              currentHistory.push({ role: 'System', text: `Yerel SSD hafızasından gelen sonuçlar:\n${memoryResults}\n\nÖNEMLİ GÖREV: Bu hafıza sonuçlarını kullanarak BİZZAT KENDİN DETAYLI RAPOR HAZIRLA. Eğer araştırma bittiyse nihai raporunu SONUÇ: tagi ile yaz.` });
              continue;
            }
          } catch (e) {
            addLog(`Araç ayrıştırma hatası tespit edildi. Modele uyarı gönderiliyor...`);
            currentHistory.push({ role: 'Assistant', text: stepResponse });
            currentHistory.push({ role: 'System', text: `[SİSTEM HATASI] Geçersiz JSON formatı veya birden fazla JSON girdisi saptandı. TEK SEFERDE SADECE BİR ARAÇ (BİR JSON) YAZ. Eğer araştırma bittiyse SONUÇ: tagi ile raporunu tamamla.` });
            continue;
          }
        }

        // If it outputs "SONUÇ:" or no JSON tools were successfully used:
        if (stepResponse.includes("SONUÇ:")) {
          addLog('Araştırma tamamlandı. Nihai rapor derleniyor...');
          finalResponse = stepResponse;
          break;
        } else {
          // LLM forgot to use tools and forgot SONUÇ tag. Warn it.
          addLog('Model tanımsız formatta yanıt verdi. Uyarı gönderiliyor...');
          currentHistory.push({ role: 'Assistant', text: stepResponse });
          currentHistory.push({ role: 'System', text: `[SİSTEM UYARISI] Hiçbir JSON aracı kullanmadın ve "SONUÇ:" tagiyle rapor yazmadın. Lütfen ya arama/okuma JSON aracı kullan ya da işin bittiyse SONUÇ: diyerek raporunu yaz.` });
          continue;
        }
      }
      
      setFinalReport(finalResponse);
      addLog('Protokol başarıyla sonlandırıldı.');
      
      // Send Push Notification
      try {
        await notifee.requestPermission();
        const channelId = await notifee.createChannel({
          id: 'aisistan_tasks',
          name: 'Derin Düşünme Görevleri',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          title: 'Aisistan: Araştırma Tamamlandı 🚀',
          body: 'Derin düşünme protokolü bitti. Raporunu okumak için uygulamaya dön!',
          android: {
            channelId,
          },
        });
      } catch (e) {
        console.warn("Bildirim gönderilemedi", e);
      }

    } catch (e) {
      console.warn("LLM error", e);
      addLog("KRİTİK HATA: Model işlemi yarıda kesti.");
    } finally {
      setIsThinking(false);
    }
  };

  const buildPrompt = (history: {role: string, text: string}[]) => {
    let p = "";
    history.forEach(msg => {
      if (msg.role === 'user') p += `<start_of_turn>user\n${msg.text}<end_of_turn>\n`;
      else if (msg.role === 'Assistant') p += `<start_of_turn>model\n${msg.text}<end_of_turn>\n`;
      else if (msg.role === 'System') p += `<start_of_turn>user\n[SİSTEM VERİSİ]: ${msg.text}<end_of_turn>\n`;
    });
    p += `<start_of_turn>model\n`;
    return p;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Otonom Ajan Paneli</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Araştırılacak karmaşık konuyu yaz..."
          placeholderTextColor="#64748B"
          value={query}
          onChangeText={setQuery}
          multiline
        />
        <TouchableOpacity 
          style={[styles.button, isThinking && styles.buttonDisabled]} 
          onPress={handleDeepThink}
          disabled={isThinking}
        >
          {isThinking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Başlat</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.logContainer}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>

      {finalReport && (
        <ScrollView style={styles.reportContainer}>
          <Text style={styles.reportHeader}>Nihai Rapor</Text>
          <Markdown style={markdownStyles}>
            {finalReport.replace(/SONUÇ:/i, '').trim()}
          </Markdown>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    padding: 16,
  },
  header: {
    color: '#38BDF8',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 100,
  },
  button: {
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#475569',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 200,
    marginBottom: 16,
  },
  logText: {
    color: '#10B981',
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 4,
  },
  reportContainer: {
    flex: 2,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
  },
  reportHeader: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
});

const markdownStyles = StyleSheet.create({
  body: { color: '#F8FAFC', fontSize: 15, lineHeight: 22 },
  heading1: { color: '#38BDF8', marginTop: 10 },
  heading2: { color: '#38BDF8', marginTop: 8 },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', fontFamily: 'Courier' },
  code_block: { backgroundColor: '#000', color: '#10B981', fontFamily: 'Courier' },
  link: { color: '#38BDF8', textDecorationLine: 'underline' }
});

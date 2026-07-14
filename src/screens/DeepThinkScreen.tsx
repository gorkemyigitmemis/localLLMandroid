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
    
    let currentHistory = [
      { role: 'System', text: `Sen Otonom bir Araştırmacı Ajansın. Kullanıcının verdiği devasa görevi başarmak için arama (search), okuma (read_site) ve hafıza tarama (search_memory) araçlarını arka arkaya defalarca kullanabilirsin. İşin tamamen bittiğinde SONUÇ: diyerek nihai markdown raporunu yaz.${persona ? `\n\nKULLANICI ÇEKİRDEK HAFIZASI (Görev yaparken buna göre davran):\n${persona}` : ''}` },
      { role: 'user', text: query }
    ];

    let finalResponse = "";

    try {
      // Extended loop limit for Deep Think mode (10 iterations)
      for (let step = 1; step <= 8; step++) {
        addLog(`Adım ${step}: Model analiz yapıyor...`);
        let stepResponse = "";
        
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

        const jsonMatch = stepResponse.match(/\{[\s\S]*"action"[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const actionData = JSON.parse(jsonMatch[0]);
            
            if (actionData.action === 'search' && actionData.query) {
              // Smart Query Pre-processing
              let finalQuery = actionData.query;
              const lowerQ = finalQuery.toLowerCase();
              if (lowerQ.includes('fiyat') || lowerQ.includes('kaç tl')) {
                finalQuery += ' site:cimri.com OR site:akakce.com';
              }
              if (lowerQ.includes('hava') || lowerQ.includes('bugün')) {
                finalQuery += ` ${new Date().toLocaleDateString('tr-TR')}`;
              }

              addLog(`Araç tetiklendi: Web Arama -> "${finalQuery}"`);
              const searchResults = await performWebSearch(finalQuery);
              addLog(`Arama sonuçları başarıyla çekildi. (${searchResults.length} karakter)`);
              
              currentHistory.push({ role: 'Assistant', text: stepResponse });
              currentHistory.push({ role: 'System', text: `Arama sonuçları:\n${searchResults}\n\nÖNEMLİ GÖREV: Kullanıcıya asla link verip geçme! Arama sonuçlarındaki bilgileri MADDELER HALİNDE KENDİN DERLE. Daha fazla veriye ihtiyacın varsa site okuyabilirsin (read_site), yeterliyse nihai raporunu SONUÇ: tagi ile yaz.` });
              continue;
            } 
            else if (actionData.action === 'read_site' && actionData.url) {
              addLog(`Araç tetiklendi: Site Kazıma -> "${actionData.url}"`);
              const rawText = await scrapeWebsite(actionData.url);
              const relevantChunk = chunkAndRetrieve(rawText, query, 3);
              
              // Hafızaya (SSD) kaydet
              await saveToMemory(actionData.url, relevantChunk);

              addLog(`Siteden en uygun veri parçaları koparıldı ve diske kaydedildi. (${relevantChunk.length} karakter)`);

              currentHistory.push({ role: 'Assistant', text: stepResponse });
              currentHistory.push({ role: 'System', text: `[${actionData.url}] içerik özeti:\n${relevantChunk}\n\nÖNEMLİ GÖREV: Bu verileri analiz et ve kullanıcının sorusuna detaylı bir rapor olarak sun. 'Şu linke bak' demek YASAKTIR. Eğer araştırma bittiyse nihai raporunu SONUÇ: tagi ile yaz.` });
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
            addLog(`Araç ayrıştırma hatası, veri doğal dil olarak kabul ediliyor.`);
          }
        }

        // If it outputs "SONUÇ:" or no tools used, consider it done
        addLog('Araştırma tamamlandı. Nihai rapor derleniyor...');
        finalResponse = stepResponse;
        break;
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

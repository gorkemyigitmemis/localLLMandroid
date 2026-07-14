import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Voice from '@react-native-community/voice';
import Tts from 'react-native-tts';
import { initLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DocumentPicker from 'react-native-document-picker';

export const VoiceScreen: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Tts Initialization
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('tr-TR');
      Tts.setDefaultRate(0.5);
    });

    // Voice Initialization
    Voice.onSpeechResults = (e) => {
      const text = e.value?.[0] || '';
      setTranscript(text);
      if (text.length > 0) {
        handleProcessSpeech(text);
      }
    };
    
    Voice.onSpeechEnd = () => {
      setIsListening(false);
    };

    loadSavedModel();

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (llamaContext) {
        llamaContext.release();
      }
    };
  }, []);

  const loadSavedModel = async () => {
    try {
      // Find any gguf file in the document directory
      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const ggufFile = files.find(f => f.name.endsWith('.gguf'));
      if (ggufFile) {
        const context = await initLlama({
          model: ggufFile.path,
          use_mlock: true,
          n_ctx: 1024,
        });
        setLlamaContext(context);
        setIsModelLoaded(true);
      }
    } catch (e) {
      console.warn("Model yüklenemedi", e);
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

      setTranscript('Model Kopyalanıyor...');

      const destPath = `${RNFS.DocumentDirectoryPath}/${res.name}`;
      const exists = await RNFS.exists(destPath);
      if (exists) {
        await RNFS.unlink(destPath);
      }

      await RNFS.copyFile(res.uri, destPath);
      
      const context = await initLlama({
        model: destPath,
        use_mlock: true,
        n_ctx: 1024,
      });
      setLlamaContext(context);
      setIsModelLoaded(true);
      setTranscript('');
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error(err);
      }
      setTranscript('Hata oluştu.');
    }
  };

  const handleProcessSpeech = async (text: string) => {
    if (!llamaContext) return;
    
    setTranscript('Düşünüyor...');
    const prompt = `<start_of_turn>user\n${text}<end_of_turn>\n<start_of_turn>model\n`;
    let response = "";
    
    try {
      await llamaContext.completion(
        {
          prompt: prompt,
          n_predict: 200,
          temperature: 0.7,
        },
        (data) => {
          response += data.token;
        }
      );
      
      setTranscript(response.trim());
      Tts.speak(response.trim());
      
    } catch (e) {
      console.warn("LLM Hatası", e);
      setTranscript("Bir hata oluştu.");
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      await Voice.stop();
      setIsListening(false);
    } else {
      setTranscript('Dinleniyor...');
      await Voice.start('tr-TR');
      setIsListening(true);
      startPulse();
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  };

  if (!isModelLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Telsiz Modu</Text>
        <View style={styles.centerBox}>
          <Text style={styles.statusText}>Lütfen bir yapay zeka modeli (.gguf) seçin.</Text>
          <TouchableOpacity style={styles.modelButton} onPress={handleSelectModel}>
            <Text style={styles.modelButtonText}>GGUF Modeli Yükle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Telsiz Modu</Text>
      
      <View style={styles.centerBox}>
        <Text style={styles.transcript}>{transcript}</Text>
      </View>

      <TouchableOpacity 
        style={styles.micButtonContainer} 
        onPress={toggleListening}
      >
        <Animated.View style={[styles.micButton, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.micIcon}>{isListening ? '🛑' : '🎙️'}</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: 'bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  transcript: {
    color: '#38BDF8',
    fontSize: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 18,
    marginTop: '50%',
  },
  micButtonContainer: {
    marginBottom: 40,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  micIcon: {
    fontSize: 40,
  },
  modelButton: {
    backgroundColor: '#0A84FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  modelButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Voice from '@react-native-community/voice';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGlobalLlamaContext } from '../utils/llamaManager';

export const VoiceScreen: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const llamaContext = getGlobalLlamaContext();
  
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

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

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

  if (!llamaContext) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Telsiz Modu</Text>
        <View style={styles.centerBox}>
          <Text style={styles.statusText}>Sistem Hatası: Yapay Zeka Belleği Bulunamadı.</Text>
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
});

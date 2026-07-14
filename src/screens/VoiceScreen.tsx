import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.gradientCircle, styles.circle1]} />
        <View style={[styles.gradientCircle, styles.circle2]} />
        <BlurView style={StyleSheet.absoluteFill} blurType="dark" blurAmount={30} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Telsiz Modu</Text>
        </View>
        
        <View style={styles.centerBox}>
          <Text style={styles.transcript}>{transcript || "Bir şeyler söyle..."}</Text>
        </View>

        <TouchableOpacity 
          style={styles.micButtonContainer} 
          onPress={toggleListening}
        >
          <Animated.View style={[styles.micButton, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.micIcon}>{isListening ? '🛑' : '🎙️'}</Text>
          </Animated.View>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradientCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.3,
  },
  circle1: {
    top: '10%',
    left: -100,
    backgroundColor: '#0284C7',
  },
  circle2: {
    bottom: '20%',
    right: -100,
    backgroundColor: '#8B5CF6',
  },
  header: {
    marginTop: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
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
    marginBottom: 60,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  micIcon: {
    fontSize: 40,
  },
});

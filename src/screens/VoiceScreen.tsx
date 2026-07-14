import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PermissionsAndroid, Platform, Alert } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Voice from '@react-native-community/voice';
import Tts from 'react-native-tts';
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
      pulseAnim.setValue(1);
    } else {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert("İzin Hatası", "Telsiz modunu kullanmak için mikrofon izni gereklidir.");
          return;
        }
      }

      setTranscript('Dinleniyor...');
      try {
        await Voice.start('tr-TR');
        setIsListening(true);
        startPulse();
      } catch (e) {
        console.error("Voice start error", e);
        Alert.alert("Hata", "Mikrofon başlatılamadı.");
      }
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
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
    backgroundColor: '#030712', // Very dark background
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradientCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.25,
  },
  circle1: {
    top: '-5%',
    left: -150,
    backgroundColor: '#0EA5E9', // Vibrant blue
  },
  circle2: {
    bottom: '-10%',
    right: -150,
    backgroundColor: '#8B5CF6', // Vibrant purple
  },
  header: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    width: '100%',
  },
  transcript: {
    color: '#E0F2FE',
    fontSize: 32,
    textAlign: 'center',
    fontWeight: '300',
    lineHeight: 44,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 18,
    marginTop: '50%',
  },
  micButtonContainer: {
    marginBottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(14, 165, 233, 0.4)',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  micIcon: {
    fontSize: 40,
  },
});

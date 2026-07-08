import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-community/voice';
import { launchImageLibrary } from 'react-native-image-picker';
import TextRecognition from 'react-native-text-recognition';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechEnd = onSpeechEnd;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechResults = (e: SpeechResultsEvent) => {
    if (e.value && e.value.length > 0) {
      setText(e.value[0]);
      // Optional: Auto-send after a pause, but it's safer to let user review
    }
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.error('Speech recognition error:', e.error);
    setIsRecording(false);
  };

  const onSpeechEnd = () => {
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await Voice.stop();
        setIsRecording(false);
      } else {
        setText('');
        setIsRecording(true);
        await Voice.start('tr-TR');
      }
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const handleImagePick = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });
    if (result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        setIsAnalyzing(true);
        try {
          const recognizedText = await TextRecognition.recognize(uri);
          if (recognizedText && recognizedText.length > 0) {
            const combinedText = recognizedText.join(' ');
            setText((prev) => prev + (prev.length > 0 ? '\n' : '') + `[FOTOĞRAF METNİ: ${combinedText}]`);
          }
        } catch (err) {
          console.error("OCR Error", err);
        } finally {
          setIsAnalyzing(false);
        }
      }
    }
  };

  const handleSend = () => {
    if (text.trim() && !disabled) {
      if (isRecording) {
        Voice.stop();
        setIsRecording(false);
      }
      onSend(text.trim());
      setText('');
    }
  };

  const isTyping = text.trim().length > 0;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        value={text}
        onChangeText={setText}
        placeholder={isRecording ? "Dinleniyor..." : "Mesaj yazın..."}
        placeholderTextColor={isDark ? "#8E8E93" : "#C7C7CC"}
        multiline
        editable={!disabled}
      />
      
      {!isTyping ? (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.micButton, isDark && styles.micButtonDark]}
            onPress={handleImagePick}
            disabled={disabled || isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={isDark ? "#0A84FF" : "#007AFF"} />
            ) : (
              <Text style={styles.micIcon}>📸</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.micButton, isDark && styles.micButtonDark, isRecording && styles.micButtonActive]}
            onPress={toggleRecording}
            disabled={disabled}
          >
            <Text style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>Gönder</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F6F6F6',
    alignItems: 'flex-end',
  },
  containerDark: {
    backgroundColor: '#0F172A', // Deep slate navy
    borderColor: '#1E293B',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#1E293B', // Slate 800
    borderColor: '#334155', // Slate 700
    color: '#F8FAFC',
  },
  button: {
    marginLeft: 10,
    marginBottom: 5,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A1C8F7',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micButton: {
    marginLeft: 10,
    marginBottom: 5,
    backgroundColor: '#E5E5EA',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDark: {
    backgroundColor: '#1E293B', // Slate 800
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
  },
  micIcon: {
    fontSize: 18,
  },
});

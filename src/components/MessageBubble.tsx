import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, useColorScheme } from 'react-native';
import Tts from 'react-native-tts';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface Props {
  message: Message;
}

export const MessageBubble = React.memo<Props>(({ message }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSpeech = () => {
    try {
      const cleanText = message.text.replace(/🔍.*?(\n|$)/g, '').replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1').trim();
      if (cleanText.length > 0) {
        Tts.speak(cleanText);
      }
    } catch (e) {
      console.warn("TTS speak error", e);
    }
  };

  const renderText = (text: string, isUser: boolean) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const linkText = match[1];
      const linkUrl = match[2];
      
      parts.push(
        <Text 
          key={match.index} 
          style={[styles.text, styles.linkText, isUser ? styles.userLinkText : styles.botLinkText]} 
          onPress={() => Linking.openURL(linkUrl)}
        >
          {linkText}
        </Text>
      );
      
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <Text style={[styles.text, isUser ? styles.userText : (isDark ? styles.botTextDark : styles.botText)]}>
        {parts}
      </Text>
    );
  };

  return (
    <View style={[styles.container, message.isUser ? styles.userContainer : styles.botContainer]}>
      <View style={[
        styles.bubble, 
        message.isUser ? styles.userBubble : (isDark ? styles.botBubbleDark : styles.botBubble)
      ]}>
        {renderText(message.text, message.isUser)}
        
        {!message.isUser && message.text.length > 0 && !message.text.includes('Düşünüyor...') && !message.text.includes('İnternette aranıyor') && (
          <TouchableOpacity onPress={handleSpeech} style={[styles.ttsButton, isDark && styles.ttsButtonDark]}>
            <Text style={[styles.ttsText, isDark && styles.ttsTextDark]}>🔊 Sesli Oku</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
    flexDirection: 'row',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#0A84FF', // iMessage Blue
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  botBubbleDark: {
    backgroundColor: '#1C1C1E',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#1C1C1E',
  },
  botTextDark: {
    color: '#F2F2F7',
  },
  ttsButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  ttsButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  ttsText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  ttsTextDark: {
    color: '#0A84FF',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  userLinkText: {
    color: '#FFFFFF',
  },
  botLinkText: {
    color: '#007AFF',
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import Tts from 'react-native-tts';
import Markdown from 'react-native-markdown-display';

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

  const renderContent = (text: string, isUser: boolean) => {
    if (isUser || text.includes('🔍')) {
      return (
        <Text style={[styles.text, isUser ? styles.userText : (isDark ? styles.botTextDark : styles.botText)]}>
          {text}
        </Text>
      );
    }
    
    // For bot, render proper markdown
    return (
      <Markdown 
        style={isDark ? markdownStylesDark : markdownStylesLight}
      >
        {text}
      </Markdown>
    );
  };

  return (
    <View style={[styles.container, message.isUser ? styles.userContainer : styles.botContainer]}>
      <View style={[
        styles.bubble, 
        message.isUser ? styles.userBubble : (isDark ? styles.botBubbleDark : styles.botBubble)
      ]}>
        {renderContent(message.text, message.isUser)}
        
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
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#F8FAFC',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  ttsText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  ttsTextDark: {
    color: '#38BDF8',
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

const baseMarkdown = {
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  code_inline: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 4,
    borderRadius: 4,
    fontFamily: 'Courier',
  },
  code_block: {
    backgroundColor: '#1C1C1E',
    padding: 10,
    borderRadius: 8,
    color: '#F8FAFC',
    fontFamily: 'Courier',
    marginVertical: 10,
  },
};

const markdownStylesLight = StyleSheet.create({
  ...baseMarkdown,
  body: {
    ...baseMarkdown.body,
    color: '#1C1C1E',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});

const markdownStylesDark = StyleSheet.create({
  ...baseMarkdown,
  body: {
    ...baseMarkdown.body,
    color: '#F8FAFC',
  },
  link: {
    color: '#38BDF8',
    textDecorationLine: 'underline',
  },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 4,
    borderRadius: 4,
    fontFamily: 'Courier',
  },
});

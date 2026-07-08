import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface Props {
  message: Message;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  return (
    <View style={[styles.container, message.isUser ? styles.userContainer : styles.botContainer]}>
      <View style={[styles.bubble, message.isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.text, message.isUser ? styles.userText : styles.botText]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 10,
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
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#DCF8C6', // WhatsApp green
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  text: {
    fontSize: 16,
  },
  userText: {
    color: '#000000',
  },
  botText: {
    color: '#000000',
  },
});

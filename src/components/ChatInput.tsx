import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Mesaj yazın..."
        multiline
        editable={!disabled}
      />
      <TouchableOpacity
        style={[styles.button, (!text.trim() || disabled) && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={styles.buttonText}>Gönder</Text>
      </TouchableOpacity>
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
});

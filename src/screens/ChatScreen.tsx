import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Text, ActivityIndicator } from 'react-native';
import { initLlama, LlamaContext } from 'llama.rn';
import { MessageBubble, Message } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [llamaContext, setLlamaContext] = useState<LlamaContext | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const currentStreamMessageId = useRef<string | null>(null);

  useEffect(() => {
    // Simulate loading the model into RAM.
    // In a real app, you would provide the path to your actual .gguf model
    // e.g., require('../../assets/models/llama-2-7b.Q4_K_M.gguf')
    const loadModel = async () => {
      try {
        setIsLoading(true);
        // We require the local dummy file so Metro bundles it.
        // During GitHub Actions, this dummy is replaced with the real GGUF file.
        const modelFile = require('../../assets/models/gemma.gguf');
        
        const context = await initLlama({
          model: modelFile,
          use_mlock: true,
          n_ctx: 2048,
          n_gpu_layers: 1,
        });
        setLlamaContext(context);
      } catch (error) {
        console.warn("Model yüklenemedi (Gerçek bir cihazda .gguf dosyası gerektirir):", error);
      } finally {
        // Simulate a slight delay for UI showcase if it failed fast
        setTimeout(() => {
          setIsLoading(false);
        }, 1500);
      }
    };

    loadModel();

    return () => {
      if (llamaContext) {
        llamaContext.release();
      }
    };
  }, []);

  const handleSend = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const botMessageId = (Date.now() + 1).toString();
    currentStreamMessageId.current = botMessageId;

    const botMessage: Message = {
      id: botMessageId,
      text: '',
      isUser: false,
    };

    setMessages((prev) => [...prev, botMessage]);

    if (llamaContext) {
      try {
        // Here we call the real LLaMA stream
        await llamaContext.completion(
          {
            prompt: `User: ${text}\nAssistant:`,
            n_predict: 100,
            temperature: 0.7,
          },
          (data) => {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === currentStreamMessageId.current
                  ? { ...msg, text: msg.text + data.token }
                  : msg
              )
            );
          }
        );
      } catch (error) {
        console.error("LLaMA completion error:", error);
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === currentStreamMessageId.current
              ? { ...msg, text: "Bir hata oluştu. Lütfen tekrar deneyin." }
              : msg
          )
        );
      }
    } else {
      // Fallback/Mock streaming if Llama is not properly initialized on simulator
      mockStreamResponse();
    }

    setIsStreaming(false);
  };

  const mockStreamResponse = () => {
    const words = "Merhaba, ben yerel LLM asistanınızım. Size nasıl yardımcı olabilirim?".split(' ');
    let currentIndex = 0;

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          const word = words[currentIndex] + ' ';
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === currentStreamMessageId.current
                ? { ...msg, text: msg.text + word }
                : msg
            )
          );
          currentIndex++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Yerel Model Yükleniyor...</Text>
        <Text style={styles.loadingSubText}>(Lütfen bekleyin, bu işlem RAM boyutuna göre değişebilir)</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFEFEF', // WhatsApp background color
  },
  listContent: {
    paddingVertical: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

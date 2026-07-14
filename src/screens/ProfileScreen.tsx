import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ProfileScreen: React.FC = () => {
  const [persona, setPersona] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    loadPersona();
  }, []);

  const loadPersona = async () => {
    try {
      const saved = await AsyncStorage.getItem('@user_persona');
      if (saved) setPersona(saved);
    } catch (e) {
      console.warn("Profil yüklenemedi", e);
    }
  };

  const savePersona = async () => {
    setIsSaving(true);
    try {
      await AsyncStorage.setItem('@user_persona', persona);
      Alert.alert('Başarılı', 'Çekirdek hafıza güncellendi. Aisistan artık seni tanıyor!');
    } catch (e) {
      console.error(e);
      Alert.alert('Hata', 'Profil kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Text style={styles.header}>Çekirdek Hafıza (Persona)</Text>
      <Text style={styles.description}>
        Aisistan'ın seni daha iyi tanıması için buraya notlar bırak. Yaşın, mesleğin, hobilerin veya sana nasıl hitap etmesini istediğini yazabilirsin. Aisistan bu bilgileri her sohbette gizlice hatırlayacak.
      </Text>
      
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="Örn: Adım Ahmet. Yazılım mühendisiyim, İstanbul'da yaşıyorum. Teknolojiyi seviyorum ve bana her zaman samimi bir dille 'Dostum' diyerek hitap et."
        placeholderTextColor="#64748B"
        multiline
        value={persona}
        onChangeText={setPersona}
      />

      <TouchableOpacity style={styles.saveButton} onPress={savePersona} disabled={isSaving}>
        <Text style={styles.saveButtonText}>{isSaving ? 'Kaydediliyor...' : 'Hafızaya Kazı'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F6F6F6',
  },
  containerDark: {
    backgroundColor: '#0F172A', // Slate 900
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  inputDark: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#0284C7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

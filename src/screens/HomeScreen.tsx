import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark' || true; // Currently defaulting to dark theme heavily

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aisistan OS</Text>
      <Text style={styles.subtitle}>Nasıl yardımcı olabilirim?</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => navigation.navigate('Chat')}
        >
          <Text style={styles.cardIcon}>💬</Text>
          <Text style={styles.cardTitle}>Klasik Sohbet</Text>
          <Text style={styles.cardDesc}>Metin, resim, kod ve asistan özellikleri.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card} 
          onPress={() => navigation.navigate('Voice')}
        >
          <Text style={styles.cardIcon}>🎙️</Text>
          <Text style={styles.cardTitle}>Telsiz Modu</Text>
          <Text style={styles.cardDesc}>Gerçek zamanlı sesli iletişim arayüzü.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card} 
          onPress={() => navigation.navigate('DeepThink')}
        >
          <Text style={styles.cardIcon}>🧠</Text>
          <Text style={styles.cardTitle}>Derin Düşünme</Text>
          <Text style={styles.cardDesc}>Otonom internet tarama ve raporlama.</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

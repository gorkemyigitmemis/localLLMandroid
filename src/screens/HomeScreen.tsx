import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Animated, useColorScheme, ImageBackground } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { loadGlobalModel, getGlobalLlamaContext } from '../utils/llamaManager';
import { ActivityIndicator, Alert } from 'react-native';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const AnimatedCard = ({ title, desc, icon, onPress, delay = 0 }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }, { translateY: translateYAnim }], opacity: opacityAnim }]}>
        <BlurView
          style={styles.absoluteBlur}
          blurType="dark"
          blurAmount={20}
          reducedTransparencyFallbackColor="black"
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardIcon}>{icon}</Text>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDesc}>{desc}</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      const ctx = await loadGlobalModel();
      if (ctx) setIsLoaded(true);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleSelectModel = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
      });

      if (!res.name?.endsWith('.gguf')) {
        Alert.alert('Geçersiz Dosya', 'Lütfen .gguf uzantılı bir model dosyası seçin.');
        return;
      }

      setIsLoading(true);

      const destPath = `${RNFS.DocumentDirectoryPath}/${res.name}`;
      const exists = await RNFS.exists(destPath);
      if (exists) {
        await RNFS.unlink(destPath);
      }

      await RNFS.copyFile(res.uri, destPath);
      
      const ctx = await loadGlobalModel(destPath);
      if (ctx) setIsLoaded(true);
      
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradients}>
        <View style={[styles.gradientCircle, styles.circle1]} />
        <View style={[styles.gradientCircle, styles.circle2]} />
      </View>
      
      <BlurView style={styles.absoluteBlur} blurType="dark" blurAmount={30} />

      {!isLoaded ? (
        <View style={styles.content}>
          <Text style={styles.title}>Aisistan OS</Text>
          <Text style={styles.subtitle}>Sistemi başlatmak için çekirdek yapay zeka modelini (.gguf) yükleyin.</Text>
          
          <View style={styles.barrierContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#0A84FF" />
            ) : (
              <TouchableWithoutFeedback onPress={handleSelectModel}>
                <View style={styles.uploadButton}>
                  <Text style={styles.uploadButtonText}>GGUF Modeli Seç ve Yükle</Text>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.content}>
        <Text style={styles.title}>Aisistan OS</Text>
        <Text style={styles.subtitle}>Otonom Zeka & Yerel Hafıza</Text>

        <View style={styles.buttonContainer}>
          <AnimatedCard 
            icon="💬" 
            title="Klasik Sohbet" 
            desc="Metin, belge analizi ve internet tarama."
            onPress={() => navigation.navigate('Chat')}
            delay={0}
          />
          <AnimatedCard 
            icon="🎙️" 
            title="Telsiz Modu" 
            desc="Gerçek zamanlı sesli iletişim arayüzü."
            onPress={() => navigation.navigate('Voice')}
            delay={100}
          />
          <AnimatedCard 
            icon="🧠" 
            title="Derin Düşünme" 
            desc="Otonom araştırma ve raporlama."
            onPress={() => navigation.navigate('DeepThink')}
            delay={200}
          />
          <AnimatedCard 
            icon="👤" 
            title="Çekirdek Hafıza" 
            desc="Kişisel profilini ve ayarlarını yönet."
            onPress={() => navigation.navigate('Profile')}
            delay={300}
          />
        </View>
      </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  backgroundGradients: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  gradientCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.4,
  },
  circle1: {
    top: -50,
    left: -100,
    backgroundColor: '#0284C7',
  },
  circle2: {
    bottom: 50,
    right: -100,
    backgroundColor: '#3B82F6',
  },
  absoluteBlur: {
    ...StyleSheet.absoluteFill,
  },
  barrierContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  uploadButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
});

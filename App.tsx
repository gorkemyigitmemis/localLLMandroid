import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { DeepThinkScreen } from './src/screens/DeepThinkScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export type RootStackParamList = {
  Home: undefined;
  Chat: undefined;
  Voice: undefined;
  DeepThink: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0B1120',
            },
            headerTintColor: '#F8FAFC',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: { backgroundColor: '#0B1120' }
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Aisistan' }} 
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={{ title: 'Klasik Sohbet' }} 
          />
          <Stack.Screen 
            name="Voice" 
            component={VoiceScreen} 
            options={{ title: 'Telsiz Modu' }} 
          />
          <Stack.Screen 
            name="DeepThink" 
            component={DeepThinkScreen} 
            options={{ title: 'Derin Düşünme' }} 
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Çekirdek Hafıza' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
});

export default App;

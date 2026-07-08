import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { ChatScreen } from './src/screens/ChatScreen';

const App = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EFEFEF" />
      <ChatScreen />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFEFEF',
  },
});

export default App;

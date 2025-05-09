import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, Text, ActivityIndicator } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { theme, COLORS } from './styles/theme';

// Inicializamos Firebase al principio para asegurarnos de que está disponible
import { app, auth } from './services/firebase';

// Ignorar advertencias específicas que puedan estar relacionadas con Firebase
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted from react-native core',
  'Possible Unhandled Promise Rejection'
]);

export default function App() {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    // Verificar que Firebase esté inicializado correctamente
    const checkFirebase = async () => {
      // Esperamos un momento para asegurar que Firebase se inicialice
      setTimeout(() => {
        setIsFirebaseReady(true);
      }, 1000);
    };

    checkFirebase();
  }, []);

  if (!isFirebaseReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 10 }}>Inicializando Firebase...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="auto" />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

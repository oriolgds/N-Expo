import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, Text, ActivityIndicator, Image } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { theme, COLORS } from './styles/theme';

// Importamos Firebase (ya se inicializa en el archivo)
import { firebase } from './services/firebase';

// Ignorar advertencias específicas
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted from react-native core',
  'Possible Unhandled Promise Rejection',
  'Variant bodySmall was not provided properly'
]);

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Simplemente esperar un tiempo mínimo para que todo se inicialice
    const timer = setTimeout(() => {
      setReady(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background
      }}>
        {/* Aquí puedes usar tu logo */}
        <Image
          source={require('./assets/logo.png')}
          style={{ width: 120, height: 120, marginBottom: 20 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{
          marginTop: 15,
          fontSize: 16,
          fontWeight: 'bold',
          color: COLORS.primary
        }}>
          Cargando N-Expo...
        </Text>
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

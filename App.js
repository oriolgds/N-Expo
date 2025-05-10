import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, Text, ActivityIndicator } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { theme, COLORS } from './styles/theme';

// Importamos Firebase (ya se inicializa en el archivo)
import { firebase, auth } from './services/firebase';

// Ignorar advertencias específicas que puedan estar relacionadas con Firebase
LogBox.ignoreLogs([
  'Setting a timer',
  'AsyncStorage has been extracted from react-native core',
  'Possible Unhandled Promise Rejection',
  'Variant bodySmall was not provided properly', // Ignorar temporalmente mientras actualizamos el tema
]);

export default function App() {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    // Verificamos que Firebase y Auth estén inicializados correctamente
    const checkFirebase = async () => {
      if (firebase.apps.length > 0 && auth) {
        console.log('Firebase está inicializado correctamente');
        setIsFirebaseReady(true);
      } else {
        console.warn('Firebase no está inicializado correctamente');
        setTimeout(() => {
          if (firebase.apps.length > 0 && auth) {
            console.log('Firebase inicializado correctamente (intento posterior)');
          } else {
            console.error('No se pudo inicializar Firebase');
          }
          // Continuamos de todos modos para no bloquear la app
          setIsFirebaseReady(true);
        }, 2000);
      }
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

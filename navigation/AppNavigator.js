import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Home screens
import HomeScreen from '../screens/home/HomeScreen';
import ProfileScreen from '../screens/home/ProfileScreen';

// News screen
import NewsDetailScreen from '../screens/news/NewsDetailScreen';

// Firebase auth
import { auth, subscribeToAuthChanges, restoreSession } from '../services/firebase';
import { COLORS } from '../styles/theme';

const Stack = createStackNavigator();
const AppStack = createStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.background }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};

const MainStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="NewsDetail"
        component={NewsDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Función para inicializar y restaurar la sesión
    const initializeApp = async () => {
      try {
        // Intentar restaurar sesión sin mostrar loader extra
        const savedUser = await restoreSession();
        if (savedUser) {
          setUser(savedUser);
        }

        // Iniciar sistema de noticias en paralelo
        import('../services/newsService')
          .then(module => {
            return module.initNewsSystem();
          })
          .catch(err => {
            console.error('Error al inicializar sistema de noticias:', err);
          });

        // Suscribirse a cambios de autenticación
        const unsubscribe = subscribeToAuthChanges((authUser) => {
          setUser(authUser);
          if (initializing) setInitializing(false);
        });

        // Marcar app como lista después de un tiempo mínimo para evitar parpadeos
        setTimeout(() => {
          setInitializing(false);
          setAppReady(true);
        }, 800);

        return unsubscribe;
      } catch (error) {
        console.error("Error durante la inicialización:", error);
        setInitializing(false);
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  // Skip rendering anything if initialization is still happening
  if (!appReady) return null;

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator>
          <AppStack.Screen
            name="MainStack"
            component={MainStack}
            options={{ headerShown: false }}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Home screens (Serán creados más adelante)
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import ProfileScreen from '../screens/home/ProfileScreen';

// Firebase auth - Añadimos restoreSession a las importaciones
import { auth, subscribeToAuthChanges, restoreSession } from '../services/firebase';
import { COLORS } from '../styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

const HomeStack = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.background,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Noticias' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Buscar' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
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
  // La pantalla de carga principal estará en App.js
  if (!appReady) return null;

  return (
    <NavigationContainer>
      {user ? <HomeStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;

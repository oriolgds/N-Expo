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
  const [appReady, setAppReady] = useState(false); // Estado adicional para la inicialización completa

  useEffect(() => {
    // Función para inicializar y restaurar la sesión
    const initializeAuth = async () => {
      if (!auth) {
        console.warn('Auth object is not initialized yet');
        return;
      }

      try {
        // Intentar restaurar la sesión guardada
        const savedUser = await restoreSession();

        // Si restauramos un usuario
        if (savedUser) {
          console.log("Sesión restaurada para:", savedUser.email || savedUser.uid);
          setUser(savedUser);
        }

        // Siempre escuchar cambios de autenticación para mantener sincronizado
        const unsubscribe = subscribeToAuthChanges((currentUser) => {
          console.log('Estado de autenticación cambiado:', currentUser ? currentUser.email : 'No autenticado');

          // Si Firebase nos envía un usuario autenticado, tiene prioridad
          if (currentUser) {
            setUser(currentUser);
          } else if (user && !auth.currentUser) {
            // Si teníamos un usuario pero Firebase dice que no hay nadie autenticado
            // Solo actualizamos si proviene de un evento real de autenticación
            setUser(null);
          }

          // Marcar la inicialización como completa
          setInitializing(false);
          setAppReady(true);
        });

        // Timeout de seguridad reducido ya que ahora tenemos estado appReady
        const timeout = setTimeout(() => {
          if (initializing) {
            console.warn('Auth initialization timed out');
            setInitializing(false);
            setAppReady(true);
          }
        }, 10000);

        return () => {
          unsubscribe();
          clearTimeout(timeout);
        };
      } catch (error) {
        console.error("Error durante la inicialización de autenticación:", error);
        setInitializing(false);
        setAppReady(true);
      }
    };

    initializeAuth();
  }, []);

  // Debug del estado de autenticación
  useEffect(() => {
    console.log('Estado de usuario en AppNavigator:', user ? 'Autenticado' : 'No autenticado');
  }, [user]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 10, color: COLORS.textSecondary }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <HomeStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;

import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Obtener las credenciales de Firebase, con fallback a process.env si Constants.expoConfig no está disponible
const getFirebaseConfig = () => {
  // Intenta obtener de Constants primero
  if (Constants.expoConfig?.extra) {
    return {
      apiKey: Constants.expoConfig.extra.FIREBASE_API_KEY,
      authDomain: Constants.expoConfig.extra.FIREBASE_AUTH_DOMAIN,
      projectId: Constants.expoConfig.extra.FIREBASE_PROJECT_ID,
      storageBucket: Constants.expoConfig.extra.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: Constants.expoConfig.extra.FIREBASE_MESSAGING_SENDER_ID,
      appId: Constants.expoConfig.extra.FIREBASE_APP_ID,
      measurementId: Constants.expoConfig.extra.FIREBASE_MEASUREMENT_ID
    };
  }

  // Fallback a las variables de entorno directamente
  return {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
};

// Obtener la configuración
const firebaseConfig = getFirebaseConfig();

// Variables globales
let app;
let auth;
let db;
let analytics;

// Inicializa Firebase de manera segura
try {
  console.log("Inicializando Firebase App...");
  app = initializeApp(firebaseConfig);
  console.log("Firebase App inicializado correctamente.");

  // Inicializa Auth con persistencia para React Native
  try {
    console.log("Inicializando Firebase Auth con persistencia...");
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log("Firebase Auth inicializado correctamente con persistencia.");
  } catch (authError) {
    console.error("Error al inicializar Firebase Auth con persistencia:", authError);
    // Intentar inicializar sin personalización como último recurso
    try {
      console.log("Intentando inicialización alternativa de Auth...");
      auth = getAuth();
      console.log("Inicialización alternativa exitosa.");
    } catch (fallbackError) {
      console.error("Error en inicialización alternativa de Auth:", fallbackError);
    }
  }

  // Inicializa Firestore solo si Auth se inicializó correctamente
  if (auth) {
    try {
      console.log("Inicializando Firestore...");
      db = getFirestore(app);
      console.log("Firestore inicializado correctamente.");
    } catch (firestoreError) {
      console.error("Error al inicializar Firestore:", firestoreError);
    }
  }

  // Intentar inicializar Analytics
  try {
    console.log("Inicializando Analytics...");
    analytics = getAnalytics(app);
    console.log("Analytics inicializado correctamente.");
  } catch (analyticsError) {
    console.log("Analytics no disponible en este entorno:", analyticsError.message);
  }
} catch (error) {
  console.error("Error crítico al inicializar Firebase:", error);
  console.error("Config utilizada:", JSON.stringify({
    apiKey: firebaseConfig.apiKey ? "PRESENTE" : "NO PRESENTE",
    authDomain: firebaseConfig.authDomain ? "PRESENTE" : "NO PRESENTE",
    projectId: firebaseConfig.projectId ? "PRESENTE" : "NO PRESENTE",
    // No mostrar todo el objeto por seguridad
  }));
}

// Auth functions
export const registerUser = async (email, password, username) => {
  // Verificar que auth esté inicializado
  if (!auth) {
    throw new Error("Firebase Auth no está inicializado correctamente");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Update profile with username
    await updateProfile(userCredential.user, {
      displayName: username
    });

    // Save additional user data in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      username,
      email,
      createdAt: new Date(),
      likes: [],
      comments: []
    });

    return userCredential.user;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  // Verificar que auth esté inicializado
  if (!auth) {
    throw new Error("Firebase Auth no está inicializado correctamente");
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  // Verificar que auth esté inicializado
  if (!auth) {
    throw new Error("Firebase Auth no está inicializado correctamente");
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

export const getCurrentUser = () => {
  // Verificar que auth esté inicializado
  if (!auth) {
    console.warn("Firebase Auth no está inicializado correctamente");
    return null;
  }
  return auth.currentUser;
};

export const subscribeToAuthChanges = (callback) => {
  // Verificar que auth esté inicializado
  if (!auth) {
    console.warn("Firebase Auth no está inicializado correctamente");
    return () => { }; // Retornar una función vacía como unsubscribe
  }
  return onAuthStateChanged(auth, callback);
};

// Firestore functions
export const getUserData = async (userId) => {
  // Verificar que db esté inicializado
  if (!db) {
    throw new Error("Firestore no está inicializado correctamente");
  }

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Get user data error:", error);
    throw error;
  }
};

export { auth, db, app, analytics };
export default app;

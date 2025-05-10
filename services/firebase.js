// Usar firebase/compat para mayor compatibilidad
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configuración de Firebase
const getFirebaseConfig = () => {
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

// Inicialización de Firebase
const firebaseConfig = getFirebaseConfig();

// Verificar si ya existe una instancia de Firebase
if (!firebase.apps.length) {
  try {
    console.log("Inicializando Firebase con compatibilidad...");
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado correctamente");

    // Configuración opcional de persistencia
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
  }
} else {
  console.log("Usando instancia de Firebase existente");
  firebase.app();
}

// Referencias a servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Función para registrar usuarios
export const registerUser = async (email, password, username) => {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);

    // Actualizar perfil con nombre de usuario
    await userCredential.user.updateProfile({
      displayName: username
    });

    // Guardar datos adicionales en Firestore
    await db.collection("users").doc(userCredential.user.uid).set({
      username,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      likes: [],
      comments: []
    });

    return userCredential.user;
  } catch (error) {
    console.error("Error de registro:", error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error de login:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error de logout:", error);
    throw error;
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const subscribeToAuthChanges = (callback) => {
  return auth.onAuthStateChanged(callback);
};

export const getUserData = async (userId) => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
  } catch (error) {
    console.error("Error al obtener datos de usuario:", error);
    throw error;
  }
};

// Exportamos para usar en toda la app
export { firebase, auth, db };
export default firebase;

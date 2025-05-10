// Usar firebase/compat para mayor compatibilidad
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
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

    // Cambiamos el método de persistencia que causa problemas
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
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

// Función para registrar usuarios - siguiendo la documentación de Firestore
export const registerUser = async (email, password, username) => {
  try {
    // Crear el usuario en Authentication
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Normalizar el email para usarlo como referencia
    const normalizedEmail = email.toLowerCase().trim();

    // Crear un documento en la colección 'users' con el correo como ID del documento
    // Siguiendo el método de la documentación oficial
    await db.collection('users').doc(normalizedEmail).set({
      username: username,
      uid: user.uid,
      email: normalizedEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Actualizar el perfil del usuario en Authentication
    await user.updateProfile({
      displayName: username
    });

    console.log("Usuario registrado y datos guardados en Firestore");
    return user;
  } catch (error) {
    console.error("Error en el registro:", error);
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

// Actualizar función getUserData para buscar por email normalizado
export const getUserData = async (userId) => {
  try {
    // Primero intentamos buscar por userId
    const userDoc = await db.collection("users").doc(userId).get();

    if (userDoc.exists) {
      return userDoc.data();
    }

    // Si no encontramos por userId, puede ser que estemos buscando con el uid
    // en lugar del email. Hacemos una consulta por uid
    const querySnapshot = await db.collection("users")
      .where("uid", "==", userId)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }

    return null;
  } catch (error) {
    console.error("Error al obtener datos de usuario:", error);
    throw error;
  }
};

// Exportamos para usar en toda la app
export { firebase, auth, db };
export default firebase;

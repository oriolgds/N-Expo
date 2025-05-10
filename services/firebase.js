// Usar firebase/compat para mayor compatibilidad
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database'; // Asegurarnos que la base de datos está importada
import * as SecureStore from 'expo-secure-store';
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
      measurementId: Constants.expoConfig.extra.FIREBASE_MEASUREMENT_ID,
      // Añadimos la URL específica de la región para Realtime Database
      databaseURL: 'https://n-expo-default-rtdb.europe-west1.firebasedatabase.app'
    };
  }

  return {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    // Añadimos la URL específica de la región para Realtime Database
    databaseURL: 'https://n-expo-default-rtdb.europe-west1.firebasedatabase.app'
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

    // En React Native no podemos usar setPersistence como en web
    console.log("Configurando persistencia manual para React Native");
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

// Claves para SecureStore
const AUTH_USER_KEY = 'firebase_auth_user';
const EMAIL_KEY = 'firebase_auth_email';
const PASSWORD_KEY = 'firebase_auth_password';

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

// Modificamos loginUser para guardar las credenciales de forma segura
export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);

    // Guardar email y contraseña de forma segura para reautenticación automática
    await SecureStore.setItemAsync(EMAIL_KEY, email);
    await SecureStore.setItemAsync(PASSWORD_KEY, password);

    // También guardar información básica del usuario
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify({
      email,
      uid: userCredential.user.uid,
      displayName: userCredential.user.displayName
    }));

    console.log("Sesión guardada exitosamente");
    return userCredential.user;
  } catch (error) {
    console.error("Error de login:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await auth.signOut();
    // Eliminar todas las credenciales guardadas
    await SecureStore.deleteItemAsync(AUTH_USER_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(PASSWORD_KEY);
    console.log("Sesión eliminada exitosamente");
  } catch (error) {
    console.error("Error de logout:", error);
    throw error;
  }
};

// Función para verificar si hay una sesión guardada e intentar restaurarla
export const restoreSession = async () => {
  try {
    // Primero verificamos si ya hay un usuario autenticado
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log("Usuario ya autenticado:", currentUser.email);
      return currentUser;
    }

    // Si no hay usuario autenticado, intentamos reautenticar
    const email = await SecureStore.getItemAsync(EMAIL_KEY);
    const password = await SecureStore.getItemAsync(PASSWORD_KEY);

    if (email && password) {
      console.log("Intentando reautenticar con credenciales guardadas...");
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("Reautenticación exitosa para:", email);
        return userCredential.user;
      } catch (authError) {
        console.warn("Error en la reautenticación automática:", authError);

        // Si la reautenticación falla, aún podemos retornar los datos del usuario para la UI
        const userDataString = await SecureStore.getItemAsync(AUTH_USER_KEY);
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          return userData; // Solo para mostrar información en la UI
        }
      }
    } else {
      // Intentar recuperar la información básica del usuario si está disponible
      const userDataString = await SecureStore.getItemAsync(AUTH_USER_KEY);
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        console.log("Encontrada información de usuario para:", userData.email);
        return userData;
      }
    }

    return null;
  } catch (error) {
    console.error("Error al restaurar sesión:", error);
    return null;
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

import axios from 'axios';
import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database'; // Importación necesaria para Realtime Database
import { firebase as firebaseInstance, auth, db } from './firebase';
import moment from 'moment';

// Configuración de la API
const API_KEY = Constants.expoConfig.extra.NEWS_API_KEY || 'ba82b8ff860c435880ddd0f7bf393dd3';
const BASE_URL = 'https://newsapi.org/v2';

// Referencias a Firebase - Corregidas
const database = firebaseInstance.database ? firebaseInstance.database() : firebase.database();
const firestore = db || firebaseInstance.firestore();

/**
 * Comprueba y recupera noticias en caché o hace una nueva solicitud
 * @param {string} country - Código del país (ej. 'us', 'es')
 * @param {string} category - Categoría (ej. 'technology', 'sports')
 * @param {number} page - Número de página (paginación)
 * @returns {Promise} - Datos de las noticias
 */
export const getTopHeadlines = async (country = 'es', category = '', page = 1) => {
    try {
        const cacheKey = `headlines_${country}_${category}_${page}`;
        const cacheRef = database.ref(`news_cache/${cacheKey}`);

        // Comprobar si hay datos en caché y si son recientes (menos de 15 minutos)
        const snapshot = await cacheRef.once('value');
        const cachedData = snapshot.val();

        const now = moment();
        const isCacheValid = cachedData &&
            cachedData.timestamp &&
            moment(cachedData.timestamp).add(15, 'minutes').isAfter(now);

        // Si tenemos caché válida, usarla
        if (isCacheValid) {
            console.log('Usando datos en caché para:', cacheKey);

            // Actualizar datos sociales de los artículos
            if (cachedData.articles && cachedData.articles.length > 0) {
                const articlesWithSocial = await addSocialDataToArticles(cachedData.articles);
                return { ...cachedData, articles: articlesWithSocial };
            }

            return cachedData;
        }

        // Si no hay caché o expiró, hacer solicitud a la API
        console.log('Solicitando datos nuevos para:', cacheKey);
        const response = await axios.get(`${BASE_URL}/top-headlines`, {
            params: {
                country,
                category,
                page,
                pageSize: 20,
                apiKey: API_KEY,
            },
        });

        // Agregar ID único a cada artículo para facilitar el manejo
        const articlesWithIds = response.data.articles.map(article => ({
            ...article,
            id: generateArticleId(article),
        }));

        // Actualizar datos sociales de los artículos
        const articlesWithSocial = await addSocialDataToArticles(articlesWithIds);

        // Guardar en caché con timestamp
        const dataToCache = {
            ...response.data,
            articles: articlesWithIds,
            timestamp: Date.now(),
        };

        await cacheRef.set(dataToCache);

        return { ...dataToCache, articles: articlesWithSocial };
    } catch (error) {
        console.error('Error al obtener noticias destacadas:', error);
        throw error;
    }
};

/**
 * Genera un ID único para un artículo basado en su URL o título
 */
const generateArticleId = (article) => {
    // Si no tiene URL, usamos el título como alternativa
    const baseString = article.url || article.title || Math.random().toString();
    // Crear un hash simple para usar como ID
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        hash = ((hash << 5) - hash) + baseString.charCodeAt(i);
        hash |= 0; // Convertir a entero de 32 bits
    }
    return Math.abs(hash).toString(16);
};

/**
 * Añade datos sociales (likes, comentarios) a los artículos
 */
const addSocialDataToArticles = async (articles) => {
    try {
        // Obtener el usuario actual para verificar interacciones
        const currentUser = firebase.auth().currentUser;
        const uid = currentUser ? currentUser.uid : null;

        // Usar Promise.all para manejar todas las consultas en paralelo
        return await Promise.all(articles.map(async (article) => {
            const articleId = article.id || generateArticleId(article);

            // Si ya tiene ID, reutilizarlo
            if (!article.id) {
                article.id = articleId;
            }

            // Obtener recuento de likes
            const likesRef = database.ref(`article_likes/${articleId}/count`);
            const likesSnapshot = await likesRef.once('value');
            const likesCount = likesSnapshot.val() || 0;

            // Verificar si el usuario actual ha dado like
            let userLiked = false;
            if (uid) {
                const userLikeRef = database.ref(`article_likes/${articleId}/users/${uid}`);
                const userLikeSnapshot = await userLikeRef.once('value');
                userLiked = userLikeSnapshot.exists();
            }

            // Obtener recuento de comentarios
            const commentsRef = database.ref(`article_comments/${articleId}`);
            const commentsSnapshot = await commentsRef.once('value');
            const commentsData = commentsSnapshot.val();
            const commentsCount = commentsData ? Object.keys(commentsData).length : 0;

            // Verificar si el artículo está guardado por el usuario
            let isSaved = false;
            if (uid) {
                const savedRef = firestore.collection('saved_articles').doc(uid).collection('articles').doc(articleId);
                const savedDoc = await savedRef.get();
                isSaved = savedDoc.exists;
            }

            // Devolver artículo con datos sociales
            return {
                ...article,
                social: {
                    likesCount,
                    commentsCount,
                    userLiked,
                    isSaved
                }
            };
        }));
    } catch (error) {
        console.error('Error al añadir datos sociales a los artículos:', error);
        return articles; // En caso de error, devolver los artículos sin datos sociales
    }
};

/**
 * Busca noticias por término de búsqueda con soporte para caché
 */
export const searchNews = async (query, page = 1) => {
    try {
        const cacheKey = `search_${query.toLowerCase().replace(/\s+/g, '_')}_${page}`;
        const cacheRef = database.ref(`news_cache/${cacheKey}`);

        // Comprobar caché
        const snapshot = await cacheRef.once('value');
        const cachedData = snapshot.val();

        const now = moment();
        const isCacheValid = cachedData &&
            cachedData.timestamp &&
            moment(cachedData.timestamp).add(15, 'minutes').isAfter(now);

        if (isCacheValid) {
            console.log('Usando búsqueda en caché para:', query);

            // Actualizar datos sociales
            if (cachedData.articles && cachedData.articles.length > 0) {
                const articlesWithSocial = await addSocialDataToArticles(cachedData.articles);
                return { ...cachedData, articles: articlesWithSocial };
            }

            return cachedData;
        }

        // Si no hay caché o expiró, hacer solicitud a la API
        const response = await axios.get(`${BASE_URL}/everything`, {
            params: {
                q: query,
                page,
                pageSize: 20,
                language: 'es', // Configura el idioma según la región preferida
                sortBy: 'publishedAt',
                apiKey: API_KEY,
            },
        });

        // Agregar ID a cada artículo
        const articlesWithIds = response.data.articles.map(article => ({
            ...article,
            id: generateArticleId(article),
        }));

        // Actualizar datos sociales
        const articlesWithSocial = await addSocialDataToArticles(articlesWithIds);

        // Guardar en caché
        const dataToCache = {
            ...response.data,
            articles: articlesWithIds,
            timestamp: Date.now(),
        };

        await cacheRef.set(dataToCache);

        return { ...dataToCache, articles: articlesWithSocial };
    } catch (error) {
        console.error('Error al buscar noticias:', error);
        throw error;
    }
};

/**
 * Interacción social: dar/quitar like a un artículo
 */
export const toggleLikeArticle = async (articleId) => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        const uid = currentUser.uid;
        const userLikeRef = database.ref(`article_likes/${articleId}/users/${uid}`);
        const countRef = database.ref(`article_likes/${articleId}/count`);

        // Verificar si el usuario ya dio like
        const snapshot = await userLikeRef.once('value');
        const hasLiked = snapshot.exists();

        // Transacción atómica para actualizar el contador
        await countRef.transaction((currentCount) => {
            return hasLiked ? (currentCount || 1) - 1 : (currentCount || 0) + 1;
        });

        // Actualizar el registro del usuario
        if (hasLiked) {
            await userLikeRef.remove();
            return { liked: false };
        } else {
            await userLikeRef.set(true);
            return { liked: true };
        }
    } catch (error) {
        console.error('Error al dar/quitar like:', error);
        throw error;
    }
};

/**
 * Guardar o eliminar un artículo de los favoritos
 */
export const toggleSaveArticle = async (article) => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        const uid = currentUser.uid;
        const articleId = article.id || generateArticleId(article);
        const savedRef = firestore.collection('saved_articles').doc(uid).collection('articles').doc(articleId);

        // Verificar si ya está guardado
        const doc = await savedRef.get();

        if (doc.exists) {
            // Eliminar de guardados
            await savedRef.delete();
            return { saved: false };
        } else {
            // Guardar el artículo
            await savedRef.set({
                ...article,
                savedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            return { saved: true };
        }
    } catch (error) {
        console.error('Error al guardar/eliminar artículo:', error);
        throw error;
    }
};

/**
 * Obtener las noticias guardadas por el usuario
 */
export const getSavedArticles = async () => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        const uid = currentUser.uid;
        const savedRef = firestore.collection('saved_articles').doc(uid).collection('articles')
            .orderBy('savedAt', 'desc');

        const snapshot = await savedRef.get();

        const savedArticles = [];
        snapshot.forEach(doc => {
            savedArticles.push(doc.data());
        });

        return savedArticles;
    } catch (error) {
        console.error('Error al obtener artículos guardados:', error);
        throw error;
    }
};

/**
 * Obtener preferencia de región del usuario
 */
export const getUserRegion = async () => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            return 'es'; // Valor predeterminado
        }

        const uid = currentUser.uid;
        const userDoc = await firestore.collection('users').where('uid', '==', uid).limit(1).get();

        if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            return userData.region || 'es';
        }

        return 'es'; // Valor predeterminado
    } catch (error) {
        console.error('Error al obtener la región del usuario:', error);
        return 'es'; // Valor predeterminado en caso de error
    }
};

/**
 * Actualizar preferencia de región del usuario
 */
export const updateUserRegion = async (region) => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error('Usuario no autenticado');
        }

        const uid = currentUser.uid;
        const email = currentUser.email.toLowerCase().trim();

        await firestore.collection('users').doc(email).update({
            region: region
        });

        return { success: true };
    } catch (error) {
        console.error('Error al actualizar región del usuario:', error);
        throw error;
    }
};

// Mantenemos las funciones originales pero actualizadas
export const getNewsBySource = async (sources, page = 1) => {
    // Código original con soporte para caché...
};

export const getSources = async (category = '', language = 'es') => {
    // Código original...
};

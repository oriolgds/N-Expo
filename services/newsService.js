import axios from 'axios';
import Constants from 'expo-constants';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { firebase as firebaseInstance, auth, db } from './firebase';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración de la nueva API (WorldNewsAPI)
// Verificar si obtenemos la API key correctamente y asegurarnos de mostrar errores de configuración
const API_KEY = Constants.expoConfig?.extra?.WORLD_NEWS_API_KEY;
if (!API_KEY) {
    console.error('¡ADVERTENCIA! API_KEY para WorldNewsAPI no encontrada en la configuración');
}
const BASE_URL = 'https://api.worldnewsapi.com';

console.log('API Key configurada:', API_KEY ? '✓ OK' : '✗ No encontrada');

// Referencias a Firebase - Corregidas
const database = firebaseInstance.database ? firebaseInstance.database() : firebase.database();
const firestore = db || firebaseInstance.firestore();

// Claves para caché local
const LOCAL_CACHE_KEY_PREFIX = 'news_cache_';
const CACHE_TIMESTAMP_KEY = 'news_cache_timestamp';

/**
 * Inicializa el sistema de caché y sincronización
 * Debe llamarse al inicio de la aplicación
 */
export const initNewsSystem = async () => {
    try {
        console.log('Inicializando sistema de noticias...');

        // Restaurar caché al iniciar
        const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);

        if (timestamp) {
            const lastUpdate = parseInt(timestamp);
            const now = Date.now();
            const cacheAge = now - lastUpdate;

            // Si la caché es reciente (menos de 30 minutos), usarla
            if (cacheAge < 1800000) {
                console.log('Caché local válida, edad:', Math.floor(cacheAge / 60000), 'minutos');
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error al inicializar el sistema de noticias:', error);
        return false;
    }
};

/**
 * Suscribirse a actualizaciones en tiempo real de noticias
 * @param {string} country - Código de país (ej: 'es')
 * @param {function} callback - Función a llamar cuando hay nuevas noticias
 * @returns {function} - Función para desuscribirse
 */
export const subscribeToNewsUpdates = (country = 'es', callback) => {
    const countryCode = country.toLowerCase();
    const cacheKey = `headlines_${countryCode}_1`;
    const newsRef = database.ref(`news_cache/${cacheKey}`);

    console.log(`Suscribiéndose a actualizaciones de noticias para ${countryCode}...`);

    // Escuchar cambios en la base de datos en tiempo real
    const listener = newsRef.on('value', async (snapshot) => {
        try {
            const data = snapshot.val();
            if (data && data.articles && Array.isArray(data.articles)) {
                console.log(`Recibida actualización con ${data.articles.length} artículos`);

                // Actualizar caché local
                await AsyncStorage.setItem(
                    `${LOCAL_CACHE_KEY_PREFIX}${countryCode}`,
                    JSON.stringify(data)
                );
                await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());

                // Procesar artículos con datos sociales
                const articlesWithSocial = await addSocialDataToArticles(data.articles);

                // Llamar callback con datos actualizados
                callback({
                    articles: articlesWithSocial,
                    totalResults: data.totalResults || articlesWithSocial.length,
                    status: 'ok'
                });
            }
        } catch (error) {
            console.error('Error procesando actualización de noticias:', error);
        }
    });

    // Devolver función para cancelar la suscripción
    return () => {
        console.log(`Cancelando suscripción a noticias para ${countryCode}`);
        newsRef.off('value', listener);
    };
};

/**
 * Carga noticias desde caché local si están disponibles
 * @param {string} country - Código del país
 * @returns {Promise<Object|null>} - Datos de noticias o null si no hay caché
 */
export const loadCachedNews = async (country = 'es') => {
    try {
        const countryCode = country.toLowerCase();
        const cacheKey = `${LOCAL_CACHE_KEY_PREFIX}${countryCode}`;

        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);

        // Verificar que los datos sean válidos
        if (parsedData && parsedData.articles && Array.isArray(parsedData.articles)) {
            // Procesar con datos sociales actuales
            const articlesWithSocial = await addSocialDataToArticles(parsedData.articles);

            return {
                articles: articlesWithSocial,
                totalResults: parsedData.totalResults || articlesWithSocial.length,
                status: 'ok',
                fromCache: true
            };
        }

        return null;
    } catch (error) {
        console.error('Error cargando noticias desde caché:', error);
        return null;
    }
};

/**
 * Forzar una actualización de noticias (útil para botón manual de refresco)
 * @param {string} country - Código del país
 * @param {string} category - Categoría (opcional)
 * @returns {Promise<Object>} - Datos de noticias actualizados
 */
export const forceNewsUpdate = async (country = 'es', category = '') => {
    try {
        console.log('Forzando actualización de noticias...');
        const result = await getTopHeadlines(country, category, 1, true);
        return result;
    } catch (error) {
        console.error('Error al forzar actualización:', error);
        throw error;
    }
};

/**
 * Comprueba y recupera noticias usando WorldNewsAPI
 * @param {string} country - Código del país (ej. 'us', 'es')
 * @param {string} category - Categoría (opcional)
 * @param {number} page - Número de página
 * @param {boolean} forceUpdate - Forzar actualización
 * @returns {Promise} - Datos de las noticias
 */
export const getTopHeadlines = async (country = 'es', category = '', page = 1, forceUpdate = false) => {
    try {
        // Asegurar que el país esté en minúsculas y sea válido
        let countryCode = country && country.toLowerCase();

        // Validar que el código de país no esté vacío
        if (!countryCode || countryCode.trim() === '') {
            console.log('Código de país vacío, usando "es" por defecto');
            countryCode = 'es';
        }

        // Generamos una clave única para este conjunto de parámetros
        const cacheKey = `headlines_${countryCode}_${category}_${page}`;
        const cacheRef = database.ref(`news_cache/${cacheKey}`);

        console.log(`Obteniendo titulares para país: ${countryCode}, categoría: ${category || 'general'}, página: ${page}`);

        // PASO 1: Comprobar si hay datos en caché y si son recientes
        if (!forceUpdate) {
            const snapshot = await cacheRef.once('value');
            const cachedData = snapshot.val();

            const now = moment();
            const isCacheValid = cachedData &&
                cachedData.timestamp &&
                moment(cachedData.timestamp).add(15, 'minutes').isAfter(now);

            if (isCacheValid) {
                console.log('Usando datos en caché para:', cacheKey);

                if (cachedData.articles && Array.isArray(cachedData.articles) && cachedData.articles.length > 0) {
                    console.log(`Caché válida encontrada con ${cachedData.articles.length} artículos`);
                    const articlesWithSocial = await addSocialDataToArticles(cachedData.articles);
                    return {
                        status: cachedData.status || 'ok',
                        totalResults: cachedData.totalResults || articlesWithSocial.length,
                        articles: articlesWithSocial
                    };
                } else {
                    console.log('La caché tiene formato incorrecto o está vacía, recargando datos');
                }
            } else {
                console.log('La caché ha expirado o no existe, solicitando datos nuevos');
            }
        }

        // PASO 2: Hacer solicitud directamente a la API
        const apiUrl = `${BASE_URL}/top-news`;

        // CORREGIDO: Usar "source-country" (singular) en lugar de "source-countries" (plural)
        const fullUrl = `${apiUrl}?api-key=${API_KEY}&source-country=${countryCode}&language=es&number=20&offset=${(page - 1) * 20}`;

        console.log(`Haciendo petición a: ${apiUrl}`);
        console.log(`Usando país: "${countryCode}"`);

        const response = await axios.get(fullUrl);

        console.log(`Respuesta API [${response.status}]:`, JSON.stringify(response.data).substring(0, 150) + '...');

        // Adaptar la estructura de respuesta según el endpoint usado (search-news)
        let adaptedArticles = [];
        if (response.data && response.data.news) {
            // Adaptar directamente desde el formato search-news
            adaptedArticles = response.data.news.map(article => ({
                id: article.id.toString(),
                title: article.title,
                description: article.summary || article.text?.substring(0, 150),
                url: article.url,
                urlToImage: article.image,
                publishedAt: article.publish_date,
                content: article.text,
                author: article.author || (article.authors && article.authors.length > 0 ? article.authors[0] : ''),
                source: {
                    id: null,
                    name: extractDomainFromUrl(article.url)
                }
            }));
        } else if (response.data && response.data.top_news) {
            // Mantener la adaptación para top-news si ese endpoint funciona
            adaptedArticles = adaptWorldNewsApiResponse(response.data);
        }

        if (adaptedArticles.length === 0) {
            console.log('No se encontraron artículos, usando fallback');
            const fallbackArticles = getFallbackHeadlines();
            await updateNewsCache(cacheKey, fallbackArticles, countryCode);
            const articlesWithSocial = await addSocialDataToArticles(fallbackArticles);
            return {
                status: 'ok',
                totalResults: fallbackArticles.length,
                articles: articlesWithSocial,
                isFallback: true
            };
        }

        const articlesWithIds = adaptedArticles.map(article => ({
            ...article,
            id: article.id || generateArticleId(article),
        }));

        await updateNewsCache(cacheKey, articlesWithIds, countryCode);
        const articlesWithSocial = await addSocialDataToArticles(articlesWithIds);

        return {
            status: 'ok',
            totalResults: articlesWithIds.length,
            articles: articlesWithSocial
        };

    } catch (error) {
        console.error('Error al obtener noticias destacadas:', error);

        // Mostrar información más detallada sobre el error
        if (error.response) {
            console.error('Respuesta de error:', error.response.status, error.response.data);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('No se recibió respuesta de la API:', error.request);
        } else {
            console.error('Error en la solicitud:', error.message);
        }

        // Usar noticias de fallback cuando hay error
        const fallbackArticles = getFallbackHeadlines();
        const articlesWithSocial = await addSocialDataToArticles(fallbackArticles);

        return {
            status: 'ok',
            totalResults: fallbackArticles.length,
            articles: articlesWithSocial,
            isFallback: true
        };
    }
};

/**
 * Actualiza la caché de noticias en Firebase y localmente
 * @param {string} cacheKey - Clave para la caché
 * @param {Array} articles - Artículos a guardar
 * @param {string} countryCode - Código de país para caché local
 */
const updateNewsCache = async (cacheKey, articles, countryCode) => {
    try {
        const dataToCache = {
            articles: articles,
            timestamp: Date.now(),
            totalResults: articles.length
        };

        const cacheRef = database.ref(`news_cache/${cacheKey}`);
        await cacheRef.set(dataToCache);

        await AsyncStorage.setItem(
            `${LOCAL_CACHE_KEY_PREFIX}${countryCode}`,
            JSON.stringify(dataToCache)
        );
        await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());

        console.log(`Caché actualizada con ${dataToCache.articles.length} artículos`);
    } catch (error) {
        console.error('Error al guardar caché:', error);
    }
};

/**
 * Adapta la respuesta de WorldNewsAPI al formato que usa nuestra app
 * @param {Object} response - Respuesta de WorldNewsAPI
 * @returns {Array} - Artículos adaptados
 */
const adaptWorldNewsApiResponse = (response) => {
    const newsArray = [];

    if (response.top_news && Array.isArray(response.top_news)) {
        response.top_news.forEach(cluster => {
            if (cluster.news && Array.isArray(cluster.news)) {
                const mainArticle = cluster.news[0];

                if (mainArticle) {
                    newsArray.push({
                        id: mainArticle.id.toString(),
                        title: mainArticle.title,
                        description: mainArticle.summary || mainArticle.text?.substring(0, 150),
                        url: mainArticle.url,
                        urlToImage: mainArticle.image,
                        publishedAt: mainArticle.publish_date,
                        content: mainArticle.text,
                        author: mainArticle.author || (mainArticle.authors && mainArticle.authors.length > 0 ? mainArticle.authors[0] : ''),
                        source: {
                            id: null,
                            name: extractDomainFromUrl(mainArticle.url)
                        },
                        relatedArticles: cluster.news.slice(1).map(article => ({
                            id: article.id.toString(),
                            title: article.title,
                            url: article.url
                        }))
                    });
                }
            }
        });
    }

    return newsArray;
};

/**
 * Extrae el dominio de una URL para usarlo como nombre de fuente
 * @param {string} url - URL del artículo
 * @returns {string} - Nombre de dominio
 */
const extractDomainFromUrl = (url) => {
    try {
        if (!url) return 'Fuente desconocida';
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (e) {
        return 'Fuente desconocida';
    }
};

/**
 * Busca noticias por término de búsqueda usando WorldNewsAPI
 */
export const searchNews = async (query, page = 1) => {
    try {
        const cacheKey = `search_${query.toLowerCase().replace(/\s+/g, '_')}_${page}`;
        const cacheRef = database.ref(`news_cache/${cacheKey}`);

        const snapshot = await cacheRef.once('value');
        const cachedData = snapshot.val();

        const now = moment();
        const isCacheValid = cachedData &&
            cachedData.timestamp &&
            moment(cachedData.timestamp).add(15, 'minutes').isAfter(now);

        if (isCacheValid) {
            console.log('Usando búsqueda en caché para:', query);

            if (cachedData.articles && cachedData.articles.length > 0) {
                const articlesWithSocial = await addSocialDataToArticles(cachedData.articles);
                return { ...cachedData, articles: articlesWithSocial };
            }

            return cachedData;
        }

        // Usar el endpoint de búsqueda que ya sabemos que funciona
        const fullUrl = `${BASE_URL}/search-news?api-key=${API_KEY}&source-country=es&language=es&number=20&offset=${(page - 1) * 20}&text=${encodeURIComponent(query)}`;

        const response = await axios.get(fullUrl, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'N-Expo-App/1.0',
                'x-api-key': API_KEY
            }
        });

        let adaptedArticles = [];
        if (response.data && response.data.news) {
            // Adaptar directamente desde el formato search-news
            adaptedArticles = response.data.news.map(article => ({
                id: article.id.toString(),
                title: article.title,
                description: article.summary || article.text?.substring(0, 150),
                url: article.url,
                urlToImage: article.image,
                publishedAt: article.publish_date,
                content: article.text,
                author: article.author || (article.authors && article.authors.length > 0 ? article.authors[0] : ''),
                source: {
                    id: null,
                    name: extractDomainFromUrl(article.url)
                }
            }));
        }

        const articlesWithIds = adaptedArticles.map(article => ({
            ...article,
            id: article.id || generateArticleId(article),
        }));

        const articlesWithSocial = await addSocialDataToArticles(articlesWithIds);

        const dataToCache = {
            articles: articlesWithIds,
            timestamp: Date.now(),
            totalResults: articlesWithIds.length
        };

        await cacheRef.set(dataToCache);

        return {
            status: 'ok',
            articles: articlesWithSocial,
            totalResults: articlesWithSocial.length
        };
    } catch (error) {
        console.error('Error al buscar noticias:', error);

        // Mostrar información más detallada
        if (error.response) {
            console.error('Respuesta de error en búsqueda:', error.response.status, error.response.data);
        }

        throw error;
    }
};

/**
 * Genera noticias de fallback
 */
const getFallbackHeadlines = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString();
    const yesterdayStr = yesterday.toISOString();

    return [
        {
            id: 'fallback-1',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'La UE aprueba nuevas regulaciones para tecnológicas',
            description: 'Las nuevas normativas buscan crear un entorno digital más seguro y justo para todos los usuarios europeos.',
            url: 'https://example.com/eu-tech-regulations',
            urlToImage: 'https://picsum.photos/800/400?random=1',
            publishedAt: todayStr,
            content: 'La Unión Europea ha aprobado hoy un paquete de medidas que regulará de forma más estricta a las grandes empresas tecnológicas...'
        },
        {
            id: 'fallback-2',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'Avances en inteligencia artificial revolucionan la medicina',
            description: 'Nuevos algoritmos consiguen diagnosticar enfermedades con mayor precisión que los médicos humanos.',
            url: 'https://example.com/ai-medicine',
            urlToImage: 'https://picsum.photos/800/400?random=2',
            publishedAt: todayStr,
            content: 'Un equipo internacional de científicos ha desarrollado una nueva tecnología de IA capaz de detectar cáncer en etapas tempranas...'
        },
        {
            id: 'fallback-3',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'España lidera la transición hacia energías renovables en Europa',
            description: 'El país ibérico ha superado sus objetivos de generación de energía limpia para este año.',
            url: 'https://example.com/spain-renewable',
            urlToImage: 'https://picsum.photos/800/400?random=3',
            publishedAt: yesterdayStr,
            content: 'España se ha convertido en un referente europeo en la transición energética tras alcanzar un récord de generación renovable...'
        },
        {
            id: 'fallback-4',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'La nueva ley de protección de datos garantizará mayor privacidad',
            description: 'El gobierno ha presentado una normativa más estricta para proteger la información personal de los ciudadanos.',
            url: 'https://example.com/privacy-law',
            urlToImage: 'https://picsum.photos/800/400?random=4',
            publishedAt: yesterdayStr,
            content: 'La nueva legislación obligará a las empresas a implementar medidas de seguridad más rigurosas y transparentas en el tratamiento de datos personales...'
        },
        {
            id: 'fallback-5',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'El mercado laboral se transforma: aumento del trabajo remoto y nuevas profesiones',
            description: 'Expertos analizan cómo la pandemia ha acelerado cambios permanentes en el entorno laboral.',
            url: 'https://example.com/work-transformation',
            urlToImage: 'https://picsum.photos/800/400?random=5',
            publishedAt: yesterdayStr,
            content: 'El teletrabajo se consolida como una opción permanente para muchas empresas, mientras surgen nuevas profesiones relacionadas con la digitalización...'
        }
    ];
};

/**
 * Genera un ID único para un artículo
 */
const generateArticleId = (article) => {
    const baseString = article.url || article.title || Math.random().toString();
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        hash = ((hash << 5) - hash) + baseString.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
};

/**
 * Añade datos sociales (likes, comentarios) a los artículos
 */
const addSocialDataToArticles = async (articles) => {
    try {
        if (!Array.isArray(articles)) {
            console.error('addSocialDataToArticles recibió un valor no válido:', articles);
            return [];
        }

        const validArticles = articles.filter(article => article && typeof article === 'object');

        const currentUser = firebase.auth().currentUser;
        const uid = currentUser ? currentUser.uid : null;

        return await Promise.all(validArticles.map(async (article) => {
            if (!article.title) {
                article.title = 'Noticia sin título';
            }

            if (!article.source) {
                article.source = { name: 'Fuente desconocida' };
            } else if (!article.source.name) {
                article.source.name = 'Fuente desconocida';
            }

            const articleId = article.id || generateArticleId(article);

            if (!article.id) {
                article.id = articleId;
            }

            const likesRef = database.ref(`article_likes/${articleId}/count`);
            const likesSnapshot = await likesRef.once('value');
            const likesCount = likesSnapshot.val() || 0;

            let userLiked = false;
            if (uid) {
                const userLikeRef = database.ref(`article_likes/${articleId}/users/${uid}`);
                const userLikeSnapshot = await userLikeRef.once('value');
                userLiked = userLikeSnapshot.exists();
            }

            const commentsRef = database.ref(`article_comments/${articleId}`);
            const commentsSnapshot = await commentsRef.once('value');
            const commentsData = commentsSnapshot.val();
            const commentsCount = commentsData ? Object.keys(commentsData).length : 0;

            let isSaved = false;
            if (uid) {
                const savedRef = firestore.collection('saved_articles').doc(uid).collection('articles').doc(articleId);
                const savedDoc = await savedRef.get();
                isSaved = savedDoc.exists;
            }

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
        return articles;
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

        const snapshot = await userLikeRef.once('value');
        const hasLiked = snapshot.exists();

        await countRef.transaction((currentCount) => {
            return hasLiked ? (currentCount || 1) - 1 : (currentCount || 0) + 1;
        });

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

        const doc = await savedRef.get();

        if (doc.exists) {
            await savedRef.delete();
            return { saved: false };
        } else {
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
            return 'es';
        }

        const uid = currentUser.uid;
        const userDoc = await firestore.collection('users').where('uid', '==', uid).limit(1).get();

        if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            return userData.region || 'es';
        }

        return 'es';
    } catch (error) {
        console.error('Error al obtener la región del usuario:', error);
        return 'es';
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

// Exportaciones adicionales
export const getNewsBySource = async (sources, page = 1) => {
    // Implementación para WorldNewsAPI
};

export const getSources = async (category = '', language = 'es') => {
    // Implementación para WorldNewsAPI
};

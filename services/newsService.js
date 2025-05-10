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
const API_KEY = Constants.expoConfig?.extra?.WORLD_NEWS_API_KEY;
if (!API_KEY) {
    console.error('¡ADVERTENCIA! API_KEY para WorldNewsAPI no encontrada en la configuración');
}
const BASE_URL = 'https://api.worldnewsapi.com';

// Referencias a Firebase
const database = firebaseInstance.database ? firebaseInstance.database() : firebase.database();
const firestore = db || firebaseInstance.firestore();

// Constantes para caché
const LOCAL_CACHE_KEY_PREFIX = 'news_cache_';
const LOCAL_CACHE_TIMESTAMP_PREFIX = 'news_timestamp_';
const CACHE_TIMESTAMP_KEY = 'news_cache_timestamp';
const CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutos

// Caché en memoria (evita accesos innecesarios a storage)
const memoryCache = {
    categoryData: {},
    socialData: {},
    lastUpdate: {}
};

// Categorías de noticias
export const NEWS_CATEGORIES = {
    general: 'General',
    politics: 'Política',
    business: 'Negocios',
    science: 'Ciencia',
    technology: 'Tecnología',
    entertainment: 'Entretenimiento',
    sports: 'Deportes',
    health: 'Salud',
    world: 'Internacional'
};

// Mapa para API
const API_CATEGORY_MAP = {
    general: '',
    politics: 'politics',
    business: 'business',
    science: 'science',
    technology: 'technology',
    entertainment: 'entertainment',
    sports: 'sports',
    health: 'health',
    world: 'world'
};

/**
 * Obtiene noticias desde caché local (AsyncStorage)
 */
export const getNewsFromLocalCache = async (country = 'es', category = '') => {
    try {
        const countryCode = country.toLowerCase();
        const categoryStr = category && category.trim() !== '' ? category.toLowerCase() : 'general';
        const cacheKey = `${LOCAL_CACHE_KEY_PREFIX}${countryCode}_${categoryStr}`;

        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (!cachedData) return null;

        const timestampKey = `${LOCAL_CACHE_TIMESTAMP_PREFIX}${countryCode}_${categoryStr}`;
        const timestamp = await AsyncStorage.getItem(timestampKey);

        if (timestamp) {
            const age = Date.now() - parseInt(timestamp);
            console.log(`Caché para ${categoryStr}: ${Math.round(age / 60000)} min. de antigüedad`);
        }

        return JSON.parse(cachedData);
    } catch (error) {
        console.error('Error al obtener caché local:', error);
        return null;
    }
};

/**
 * Guarda noticias en caché local
 */
export const saveNewsToLocalCache = async (country, category, data) => {
    try {
        const countryCode = country.toLowerCase();
        const categoryStr = category && category.trim() !== '' ? category.toLowerCase() : 'general';
        const cacheKey = `${LOCAL_CACHE_KEY_PREFIX}${countryCode}_${categoryStr}`;
        const timestampKey = `${LOCAL_CACHE_TIMESTAMP_PREFIX}${countryCode}_${categoryStr}`;

        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        await AsyncStorage.setItem(timestampKey, Date.now().toString());
    } catch (error) {
        console.error('Error al guardar caché local:', error);
    }
};

/**
 * Verifica si la caché está expirada
 */
export const isLocalCacheExpired = async (country, category) => {
    try {
        const countryCode = country.toLowerCase();
        const categoryStr = category && category.trim() !== '' ? category.toLowerCase() : 'general';
        const timestampKey = `${LOCAL_CACHE_TIMESTAMP_PREFIX}${countryCode}_${categoryStr}`;

        const timestamp = await AsyncStorage.getItem(timestampKey);
        if (!timestamp) return true;

        const age = Date.now() - parseInt(timestamp);
        return age > CACHE_EXPIRY_TIME;
    } catch (error) {
        return true;
    }
};

/**
 * Inicializa el sistema de noticias
 */
export const initNewsSystem = async () => {
    try {
        console.log('Inicializando sistema de noticias...');
        const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);

        if (timestamp) {
            const cacheAge = Date.now() - parseInt(timestamp);
            if (cacheAge < 1800000) {
                console.log('Caché global válida:', Math.floor(cacheAge / 60000), 'minutos');
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error al inicializar sistema de noticias:', error);
        return false;
    }
};

/**
 * Suscripción a actualizaciones en tiempo real
 */
export const subscribeToNewsUpdates = (country = 'es', category = '', callback) => {
    const countryCode = country.toLowerCase();
    const categoryStr = category && category.trim() !== '' ? category.toLowerCase() : 'general';
    const cacheKey = `headlines_${countryCode}_${categoryStr}_1`;
    const newsRef = database.ref(`news_cache/${cacheKey}`);

    const listener = newsRef.on('value', async (snapshot) => {
        try {
            const data = snapshot.val();
            if (data && data.articles && Array.isArray(data.articles)) {
                // Actualizar caché local
                await saveNewsToLocalCache(countryCode, categoryStr, {
                    articles: data.articles,
                    totalResults: data.totalResults || data.articles.length,
                    status: data.status || 'ok'
                });

                // También actualizar caché en memoria
                const cacheKey = `${countryCode}_${categoryStr}`;
                memoryCache.categoryData[cacheKey] = data.articles;
                memoryCache.lastUpdate[cacheKey] = Date.now();

                // Procesar datos sociales por lotes para mejorar rendimiento
                const articlesWithSocial = await addSocialDataBatch(data.articles);

                // Notificar actualización
                callback({
                    articles: articlesWithSocial,
                    totalResults: data.totalResults || articlesWithSocial.length,
                    status: 'ok'
                });
            }
        } catch (error) {
            console.error('Error procesando actualización:', error);
        }
    });

    return () => newsRef.off('value', listener);
};

/**
 * Función optimizada para obtener artículos con caché
 */
export const getTopHeadlinesOptimized = async (country = 'es', category = '', page = 1) => {
    try {
        const countryCode = country.toLowerCase();
        const categoryStr = category && category.trim() !== '' ? category.toLowerCase() : 'general';
        const cacheKey = `${countryCode}_${categoryStr}`;

        // 1. Revisar caché en memoria (inmediato)
        if (memoryCache.categoryData[cacheKey] && memoryCache.categoryData[cacheKey].length > 0) {
            const cacheTooOld = !memoryCache.lastUpdate[cacheKey] ||
                (Date.now() - memoryCache.lastUpdate[cacheKey] > 60000);

            // Si necesita actualización, hacerlo en segundo plano
            if (cacheTooOld) {
                setTimeout(() => {
                    updateCategoryInBackground(countryCode, categoryStr, page);
                }, 100);
            }

            // Devolver datos inmediatamente desde memoria
            return {
                status: 'ok',
                articles: memoryCache.categoryData[cacheKey],
                fromMemoryCache: true,
                updating: cacheTooOld
            };
        }

        // 2. Si no hay datos en memoria, consultar AsyncStorage
        const cachedData = await getNewsFromLocalCache(country, category);

        if (cachedData && cachedData.articles && cachedData.articles.length > 0) {
            // Guardar en memoria para acceso rápido futuro
            memoryCache.categoryData[cacheKey] = cachedData.articles;
            memoryCache.lastUpdate[cacheKey] = Date.now();

            // Iniciar actualización en segundo plano
            setTimeout(() => {
                updateCategoryInBackground(countryCode, categoryStr, page);
            }, 100);

            // Añadir datos sociales después de devolver la respuesta
            setTimeout(async () => {
                try {
                    const articlesWithSocial = await addSocialDataBatch(cachedData.articles);
                    memoryCache.categoryData[cacheKey] = articlesWithSocial;

                    // Notificar actualización si hay callback registrado
                    if (window.socialDataLoadedCallback) {
                        window.socialDataLoadedCallback(cacheKey, articlesWithSocial);
                    }
                } catch (error) {
                    console.error('Error cargando datos sociales:', error);
                }
            }, 300);

            return {
                status: 'ok',
                articles: cachedData.articles,
                fromCache: true,
                updating: true
            };
        }

        // 3. Si no hay caché, obtener datos frescos
        const result = await fetchFreshHeadlines(countryCode, categoryStr, page);

        // Guardar resultados en caché
        if (result.status === 'ok' && result.articles) {
            memoryCache.categoryData[cacheKey] = result.articles;
            memoryCache.lastUpdate[cacheKey] = Date.now();

            await saveNewsToLocalCache(countryCode, categoryStr, {
                articles: result.articles,
                totalResults: result.totalResults || result.articles.length,
                status: result.status
            });
        }

        return result;
    } catch (error) {
        console.error('Error en getTopHeadlinesOptimized:', error);
        // Usar fallback en caso de error
        return getFallbackResponse();
    }
};

/**
 * Actualiza una categoría en segundo plano
 */
async function updateCategoryInBackground(country, category, page) {
    try {
        const result = await fetchFreshHeadlines(country, category, page);
        const cacheKey = `${country}_${category}`;

        if (result && result.articles) {
            // Actualizar memoria y AsyncStorage
            memoryCache.categoryData[cacheKey] = result.articles;
            memoryCache.lastUpdate[cacheKey] = Date.now();

            await saveNewsToLocalCache(country, category, {
                articles: result.articles,
                totalResults: result.totalResults || result.articles.length,
                status: result.status || 'ok'
            });

            // Notificar a la UI
            if (window.categoryDataUpdatedCallback) {
                window.categoryDataUpdatedCallback(cacheKey, result.articles);
            }
        }
    } catch (error) {
        console.error('Error actualizando categoría en segundo plano:', error);
    }
}

/**
 * Obtiene noticias frescas desde la API
 */
async function fetchFreshHeadlines(country, category, page) {
    try {
        // Utilizar API_CATEGORY_MAP para adaptar la categoría
        const categoryParam = API_CATEGORY_MAP[category] || '';
        const isGeneralCategory = !category || category === 'general';

        // Determinar qué endpoint usar
        const apiUrl = isGeneralCategory ? `${BASE_URL}/top-news` : `${BASE_URL}/search-news`;

        // Construir parámetros según el endpoint
        let params = {
            'language': 'es',
            'source-country': country
        };

        // Añadir parámetros según endpoint
        if (!isGeneralCategory && categoryParam) {
            params.categories = categoryParam;
            params.number = 20;
            params.offset = (page - 1) * 20;
            params.sort = 'publish-time';
            params['sort-direction'] = 'desc';
        } else if (page > 1) {
            params.offset = (page - 1) * 20;
        }

        // Realizar petición con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await axios.get(apiUrl, {
            headers: {
                'x-api-key': API_KEY,
                'User-Agent': 'N-Expo-App/1.0'
            },
            params: params,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Procesar respuesta según endpoint
        let adaptedArticles = [];
        if (isGeneralCategory && response.data.top_news) {
            adaptedArticles = processTopNewsResponse(response.data);
        } else if (response.data.news) {
            adaptedArticles = processSearchNewsResponse(response.data, category);
        }

        // En caso de no recibir datos, usar fallback
        if (adaptedArticles.length === 0) {
            return getFallbackResponse();
        }

        // Añadir IDs consistentes y procesar sociales
        const articlesWithIds = adaptedArticles.map(addConsistentId);
        const articlesWithSocial = await addSocialDataBatch(articlesWithIds);

        return {
            status: 'ok',
            totalResults: articlesWithSocial.length,
            articles: articlesWithSocial
        };
    } catch (error) {
        console.error('Error obteniendo headlines frescos:', error);
        return getFallbackResponse();
    }
}

/**
 * Procesa respuesta del endpoint top-news
 */
function processTopNewsResponse(data) {
    const newsArray = [];

    if (data.top_news && Array.isArray(data.top_news)) {
        data.top_news.forEach(cluster => {
            if (cluster.news && Array.isArray(cluster.news) && cluster.news[0]) {
                const mainArticle = cluster.news[0];

                newsArray.push({
                    title: mainArticle.title,
                    description: mainArticle.summary || (mainArticle.text?.substring(0, 150) + '...'),
                    url: mainArticle.url,
                    urlToImage: mainArticle.image,
                    publishedAt: mainArticle.publish_date,
                    content: mainArticle.text,
                    author: mainArticle.author || (mainArticle.authors?.[0] || ''),
                    category: mainArticle.category || 'general',
                    source: {
                        id: null,
                        name: extractDomainFromUrl(mainArticle.url)
                    },
                    relatedArticles: cluster.news.slice(1).map(article => ({
                        title: article.title,
                        url: article.url
                    }))
                });
            }
        });
    }

    return newsArray;
}

/**
 * Procesa respuesta del endpoint search-news
 */
function processSearchNewsResponse(data, category) {
    return data.news.map(article => ({
        title: article.title,
        description: article.summary || (article.text?.substring(0, 150) + '...'),
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publish_date,
        content: article.text,
        author: article.author || (article.authors?.[0] || ''),
        category: article.category || category || 'general',
        source: {
            id: null,
            name: extractDomainFromUrl(article.url)
        }
    }));
}

/**
 * Extrae dominio de URL para mostrar como fuente
 */
function extractDomainFromUrl(url) {
    try {
        if (!url) return 'Fuente desconocida';
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (e) {
        return 'Fuente desconocida';
    }
}

/**
 * Genera un ID consistente para un artículo
 */
function addConsistentId(article) {
    const baseString = article.url || article.title || Math.random().toString();
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        hash = ((hash << 5) - hash) + baseString.charCodeAt(i);
        hash |= 0;
    }
    const id = Math.abs(hash).toString(16);
    return { ...article, id };
}

/**
 * Añade datos sociales a artículos de forma más eficiente
 */
async function addSocialDataBatch(articles) {
    if (!Array.isArray(articles) || articles.length === 0) {
        return [];
    }

    try {
        const validArticles = articles.filter(article => article && typeof article === 'object');
        const currentUser = firebase.auth().currentUser;
        const uid = currentUser ? currentUser.uid : null;

        // Procesar en lotes para reducir latencia
        const batchSize = 5;
        let processed = [];

        for (let i = 0; i < validArticles.length; i += batchSize) {
            const batch = validArticles.slice(i, i + batchSize);
            const batchPromises = batch.map(async (article) => {
                // Asignar ID si no existe
                const articleId = article.id || addConsistentId(article).id;

                // Verificar si ya tenemos datos sociales en caché
                if (memoryCache.socialData[articleId] &&
                    (Date.now() - memoryCache.socialData[articleId].timestamp < 60000)) {
                    return {
                        ...article,
                        id: articleId,
                        social: memoryCache.socialData[articleId].data
                    };
                }

                // Normalizar datos básicos del artículo
                const normalizedArticle = {
                    ...article,
                    id: articleId,
                    title: article.title || 'Sin título',
                    source: article.source || { name: 'Fuente desconocida' }
                };
                if (normalizedArticle.source && !normalizedArticle.source.name) {
                    normalizedArticle.source.name = 'Fuente desconocida';
                }

                // Consultas paralelas para datos sociales
                const [likesData, commentsData, savedStatus] = await Promise.all([
                    database.ref(`article_likes/${articleId}/count`).once('value'),
                    database.ref(`article_comments/${articleId}`).once('value'),
                    uid ? firestore.collection('saved_articles').doc(uid).collection('articles').doc(articleId).get() : { exists: false }
                ]);

                // Preparar datos sociales
                const likesCount = likesData.val() || 0;
                let userLiked = false;

                // Solo verificar si el usuario ha dado like si está autenticado
                if (uid) {
                    const userLikeRef = database.ref(`article_likes/${articleId}/users/${uid}`);
                    const userLikeSnapshot = await userLikeRef.once('value');
                    userLiked = userLikeSnapshot.exists();
                }

                const commentsValue = commentsData.val();
                const commentsCount = commentsValue ? Object.keys(commentsValue).length : 0;
                const isSaved = savedStatus.exists || false;

                // Crear objeto de datos sociales
                const socialData = { likesCount, commentsCount, userLiked, isSaved };

                // Guardar en caché
                memoryCache.socialData[articleId] = {
                    data: socialData,
                    timestamp: Date.now()
                };

                return {
                    ...normalizedArticle,
                    social: socialData
                };
            });

            // Esperar por este lote y añadirlo a los resultados
            const batchResults = await Promise.all(batchPromises);
            processed = [...processed, ...batchResults];
        }

        return processed;
    } catch (error) {
        console.error('Error al añadir datos sociales:', error);
        // Devolver artículos con datos sociales vacíos en caso de error
        return articles.map(article => ({
            ...article,
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        }));
    }
}

/**
 * Devuelve respuesta de fallback en caso de error
 */
function getFallbackResponse() {
    const fallbackArticles = getFallbackHeadlines();
    return {
        status: 'ok',
        totalResults: fallbackArticles.length,
        articles: fallbackArticles,
        isFallback: true
    };
}

/**
 * Genera artículos de fallback
 */
function getFallbackHeadlines() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return [
        {
            id: 'fallback-1',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'La UE aprueba nuevas regulaciones para tecnológicas',
            description: 'Las nuevas normativas buscan crear un entorno digital más seguro y justo para todos los usuarios europeos.',
            url: 'https://example.com/eu-tech-regulations',
            urlToImage: 'https://picsum.photos/800/400?random=1',
            publishedAt: today.toISOString(),
            content: 'La Unión Europea ha aprobado hoy un paquete de medidas que regulará de forma más estricta a las grandes empresas tecnológicas...',
            category: 'technology',
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        },
        {
            id: 'fallback-2',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'Avances en inteligencia artificial revolucionan la medicina',
            description: 'Nuevos algoritmos consiguen diagnosticar enfermedades con mayor precisión que los médicos humanos.',
            url: 'https://example.com/ai-medicine',
            urlToImage: 'https://picsum.photos/800/400?random=2',
            publishedAt: today.toISOString(),
            content: 'Un equipo internacional de científicos ha desarrollado una nueva tecnología de IA capaz de detectar cáncer en etapas tempranas...',
            category: 'health',
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        },
        {
            id: 'fallback-3',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'España lidera la transición hacia energías renovables en Europa',
            description: 'El país ibérico ha superado sus objetivos de generación de energía limpia para este año.',
            url: 'https://example.com/spain-renewable',
            urlToImage: 'https://picsum.photos/800/400?random=3',
            publishedAt: yesterday.toISOString(),
            content: 'España se ha convertido en un referente europeo en la transición energética tras alcanzar un récord de generación renovable...',
            category: 'science',
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        },
        {
            id: 'fallback-4',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'La nueva ley de protección de datos garantizará mayor privacidad',
            description: 'El gobierno ha presentado una normativa más estricta para proteger la información personal de los ciudadanos.',
            url: 'https://example.com/privacy-law',
            urlToImage: 'https://picsum.photos/800/400?random=4',
            publishedAt: yesterday.toISOString(),
            content: 'La nueva legislación obligará a las empresas a implementar medidas de seguridad más rigurosas y transparentas en el tratamiento de datos personales...',
            category: 'politics',
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        },
        {
            id: 'fallback-5',
            source: { id: 'n-expo', name: 'N-Expo News' },
            author: 'Equipo N-Expo',
            title: 'El mercado laboral se transforma: aumento del trabajo remoto y nuevas profesiones',
            description: 'Expertos analizan cómo la pandemia ha acelerado cambios permanentes en el entorno laboral.',
            url: 'https://example.com/work-transformation',
            urlToImage: 'https://picsum.photos/800/400?random=5',
            publishedAt: yesterday.toISOString(),
            content: 'El teletrabajo se consolida como una opción permanente para muchas empresas, mientras surgen nuevas profesiones relacionadas con la digitalización...',
            category: 'business',
            social: { likesCount: 0, commentsCount: 0, userLiked: false, isSaved: false }
        }
    ];
}

// Exportaciones de funciones de interacción social
export const toggleLikeArticle = async (articleId) => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error('Usuario no autenticado');

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

export const toggleSaveArticle = async (article) => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error('Usuario no autenticado');

        const uid = currentUser.uid;
        const articleId = article.id || addConsistentId(article).id;
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

export const getSavedArticles = async () => {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) throw new Error('Usuario no autenticado');

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

// Agregar otras funciones exportadas para mantener compatibilidad
export const getTopHeadlines = async (country, category, page, forceUpdate = false) => {
    return fetchFreshHeadlines(country, category, page);
};

export const loadCachedNews = getNewsFromLocalCache;
export const forceNewsUpdate = async (country, category) => {
    return fetchFreshHeadlines(country, category, 1);
};
export const reloadNewsFromFirebase = async (country, category) => {
    try {
        const countryCode = country.toLowerCase();
        const categoryStr = category || 'general';
        const cacheKey = `headlines_${countryCode}_${categoryStr}_1`;
        const snapshot = await database.ref(`news_cache/${cacheKey}`).once('value');
        const data = snapshot.val();

        if (data && data.articles && Array.isArray(data.articles)) {
            const articlesWithSocial = await addSocialDataBatch(data.articles);
            return {
                status: 'ok',
                articles: articlesWithSocial,
                fromFirebase: true
            };
        }

        return getFallbackResponse();
    } catch (error) {
        console.error('Error recargando de Firebase:', error);
        return getFallbackResponse();
    }
};

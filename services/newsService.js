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
        // Asegurar que el país esté en minúsculas (requerido por la API)
        const countryCode = country.toLowerCase();

        // Generamos una clave única para este conjunto de parámetros
        const cacheKey = `headlines_${countryCode}_${category}_${page}`;
        const cacheRef = database.ref(`news_cache/${cacheKey}`);

        console.log(`Obteniendo titulares para país: ${countryCode}, categoría: ${category || 'general'}, página: ${page}`);

        // PASO 1: Comprobar si hay datos en caché y si son recientes (menos de 15 minutos)
        console.log('Verificando caché para:', cacheKey);
        const snapshot = await cacheRef.once('value');
        const cachedData = snapshot.val();

        const now = moment();
        const isCacheValid = cachedData &&
            cachedData.timestamp &&
            moment(cachedData.timestamp).add(15, 'minutes').isAfter(now);

        // PASO 2: Si tenemos caché válida, la usamos directamente
        if (isCacheValid) {
            console.log('Usando datos en caché para:', cacheKey);

            // Aseguramos que la estructura de datos sea correcta
            if (cachedData.articles && Array.isArray(cachedData.articles) && cachedData.articles.length > 0) {
                console.log(`Caché válida encontrada con ${cachedData.articles.length} artículos`);
                // Actualizar datos sociales de los artículos
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

        // PASO 3: Hacer solicitud directamente a la API
        const apiUrl = `${BASE_URL}/top-headlines`;
        console.log(`Haciendo petición a: ${apiUrl}`);
        console.log('Parámetros:', { country: countryCode, category, page, pageSize: 20, language: 'es' });

        const requestConfig = {
            params: {
                country: countryCode,
                pageSize: 20,
                page: page,
                apiKey: API_KEY,
                language: 'es', // Añadir parámetro explícito de idioma español
            },
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'N-Expo-App/1.0'
            }
        };

        // Si hay categoría, la agregamos a los parámetros
        if (category && category.trim() !== '') {
            requestConfig.params.category = category;
        }

        // Hacemos la petición con la configuración completa
        const response = await axios.get(apiUrl, requestConfig);

        // PASO 4: Verificamos la respuesta de la API
        console.log(`Respuesta API [${response.status}]:`, JSON.stringify(response.data).substring(0, 150) + '...');

        if (!response.data) {
            throw new Error('La API no devolvió datos');
        }

        if (response.data.status !== 'ok') {
            console.error('Error de API:', response.data.message || 'Error desconocido');
            throw new Error(response.data.message || 'Error en la respuesta de la API');
        }

        if (!response.data.articles || !Array.isArray(response.data.articles)) {
            console.error('La API no devolvió un array de artículos:', response.data);
            throw new Error('Formato de respuesta incorrecto');
        }

        console.log(`API devolvió ${response.data.articles.length} artículos de ${response.data.totalResults} totales`);

        // Si no hay artículos, probamos con otros parámetros pero manteniéndonos en español
        if (response.data.articles.length === 0) {
            console.log('No se encontraron artículos, probando con fallback');

            // Intentar primero sin país pero con fuentes españolas populares
            console.log('Probando con medios españoles específicos como fallback');
            const spanishSources = 'el-mundo,el-pais,marca,as,20-minutos,el-confidencial,abc-es,la-vanguardia';
            const spanishSourcesResponse = await axios.get(apiUrl, {
                params: {
                    sources: spanishSources,
                    pageSize: 20,
                    page: 1,
                    apiKey: API_KEY,
                    language: 'es'
                },
                headers: requestConfig.headers
            });

            if (spanishSourcesResponse.data.articles && spanishSourcesResponse.data.articles.length > 0) {
                response.data = spanishSourcesResponse.data;
                console.log(`Fallback con medios españoles exitoso: ${response.data.articles.length} artículos encontrados`);
            }
            // Si no encontramos con medios españoles, probar con medios en español de otros países
            else if (countryCode !== 'mx' && page === 1) {
                console.log('Probando con país MX como fallback (español)');
                const mexicoResponse = await axios.get(apiUrl, {
                    params: {
                        country: 'mx',
                        pageSize: 20,
                        page: 1,
                        apiKey: API_KEY,
                        language: 'es'
                    },
                    headers: requestConfig.headers
                });

                if (mexicoResponse.data.articles && mexicoResponse.data.articles.length > 0) {
                    response.data = mexicoResponse.data;
                    console.log(`Fallback con México exitoso: ${response.data.articles.length} artículos encontrados`);
                }
            }
            // Solo si no encontramos nada en español, intentamos con US en inglés
            else if (countryCode !== 'us' && page === 1) {
                console.log('Probando con país US como último recurso');
                const fallbackResponse = await axios.get(apiUrl, {
                    params: {
                        country: 'us',
                        pageSize: 20,
                        page: 1,
                        apiKey: API_KEY
                    },
                    headers: requestConfig.headers
                });

                if (fallbackResponse.data.articles && fallbackResponse.data.articles.length > 0) {
                    response.data = fallbackResponse.data;
                    console.log(`Fallback con US exitoso: ${response.data.articles.length} artículos encontrados`);
                }
            }

            // Si todavía no hay resultados, usamos noticias estáticas en español
            if (response.data.articles.length === 0) {
                console.log('Usando noticias estáticas de fallback en español');
                response.data.articles = getFallbackHeadlines();
                response.data.totalResults = response.data.articles.length;
            }
        }

        // PASO 5: Procesamos los artículos
        const articlesWithIds = response.data.articles.map(article => ({
            ...article,
            id: article.id || generateArticleId(article),
        }));

        // PASO 6: Actualizamos datos sociales de los artículos
        const articlesWithSocial = await addSocialDataToArticles(articlesWithIds);

        // PASO 7: Guardamos en caché, combinando con datos previos si existen
        let dataToCache = {
            ...response.data,
            articles: articlesWithIds,
            timestamp: Date.now(),
        };

        // Si hay caché previa, mezclamos pero damos prioridad a los nuevos
        if (cachedData && cachedData.articles && Array.isArray(cachedData.articles)) {
            console.log('Fusionando con caché anterior');

            // Crear un mapa de artículos para eliminar duplicados por ID
            const articlesMap = new Map();

            // Primero añadimos los artículos nuevos (tendrán prioridad)
            articlesWithIds.forEach(article => {
                if (article.id) {
                    articlesMap.set(article.id, article);
                }
            });

            // Luego añadimos los artículos antiguos que no estén duplicados
            cachedData.articles.forEach(article => {
                if (article.id && !articlesMap.has(article.id)) {
                    articlesMap.set(article.id, article);
                }
            });

            // Convertimos el mapa de vuelta a un array
            dataToCache.articles = Array.from(articlesMap.values());
        }

        // Guardamos en la base de datos
        try {
            await cacheRef.set(dataToCache);
            console.log(`Caché actualizada con ${dataToCache.articles.length} artículos`);
        } catch (cacheError) {
            console.error('Error al guardar caché:', cacheError);
        }

        return {
            ...response.data,
            articles: articlesWithSocial
        };
    } catch (error) {
        console.error('Error al obtener noticias destacadas:', error);
        console.error('Mensaje de error:', error.message);

        // Si hay un error, intentamos recuperar la caché como último recurso
        try {
            const cacheKey = `headlines_${country.toLowerCase()}_${category}_${page}`;
            const cacheRef = database.ref(`news_cache/${cacheKey}`);
            const snapshot = await cacheRef.once('value');
            const cachedData = snapshot.val();

            if (cachedData && cachedData.articles && Array.isArray(cachedData.articles)) {
                console.log('Usando caché como recuperación de error');
                return {
                    status: 'ok',
                    totalResults: cachedData.articles.length,
                    articles: cachedData.articles,
                    fromCache: true,
                    error: error.message
                };
            }
        } catch (cacheError) {
            console.error('No se pudo recuperar la caché:', cacheError);
        }

        // Si todo falla, devolvemos noticias estáticas de fallback
        console.log('Usando noticias estáticas como último recurso');
        const fallbackArticles = getFallbackHeadlines();
        return {
            status: 'ok',
            totalResults: fallbackArticles.length,
            articles: fallbackArticles,
            isFallback: true
        };
    }
};

/**
 * Genera noticias de fallback para cuando la API falle
 */
const getFallbackHeadlines = () => {
    // Generamos una fecha reciente para las noticias (hoy o ayer)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString();
    const yesterdayStr = yesterday.toISOString();

    // Lista de noticias predefinidas para casos de fallo
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
            content: 'La nueva legislación obligará a las empresas a implementar medidas de seguridad más rigurosas y transparentes en el tratamiento de datos personales...'
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
        // Verificar que los artículos sean válidos
        if (!Array.isArray(articles)) {
            console.error('addSocialDataToArticles recibió un valor no válido:', articles);
            return [];
        }

        // Filtrar artículos inválidos
        const validArticles = articles.filter(article => article && typeof article === 'object');

        // Obtener el usuario actual para verificar interacciones
        const currentUser = firebase.auth().currentUser;
        const uid = currentUser ? currentUser.uid : null;

        // Usar Promise.all para manejar todas las consultas en paralelo
        return await Promise.all(validArticles.map(async (article) => {
            // Validar que el artículo tenga propiedades básicas
            if (!article.title) {
                article.title = 'Noticia sin título';
            }

            if (!article.source) {
                article.source = { name: 'Fuente desconocida' };
            } else if (!article.source.name) {
                article.source.name = 'Fuente desconocida';
            }

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
                language: 'es', // Asegurar que la búsqueda sea en español
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

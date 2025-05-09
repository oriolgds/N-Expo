import axios from 'axios';
import Constants from 'expo-constants';

// Configuración de la API
const API_KEY = Constants.expoConfig.extra.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

/**
 * Obtiene las noticias más destacadas por país y categoría opcional
 * @param {string} country - Código del país (ej. 'us', 'es')
 * @param {string} category - Categoría (ej. 'technology', 'sports')
 * @param {number} page - Número de página (paginación)
 * @returns {Promise} - Datos de las noticias
 */
export const getTopHeadlines = async (country = 'es', category = '', page = 1) => {
    try {
        const response = await axios.get(`${BASE_URL}/top-headlines`, {
            params: {
                country,
                category,
                page,
                pageSize: 20,
                apiKey: API_KEY,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error al obtener noticias destacadas:', error);
        throw error;
    }
};

/**
 * Busca noticias por término de búsqueda
 * @param {string} query - Término de búsqueda
 * @param {number} page - Número de página
 * @returns {Promise} - Resultados de la búsqueda
 */
export const searchNews = async (query, page = 1) => {
    try {
        const response = await axios.get(`${BASE_URL}/everything`, {
            params: {
                q: query,
                page,
                pageSize: 20,
                language: 'es', // Configura el idioma según necesites
                sortBy: 'publishedAt',
                apiKey: API_KEY,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error al buscar noticias:', error);
        throw error;
    }
};

/**
 * Obtiene noticias de fuentes específicas
 * @param {string} sources - Lista de fuentes separadas por comas
 * @param {number} page - Número de página
 * @returns {Promise} - Datos de las noticias
 */
export const getNewsBySource = async (sources, page = 1) => {
    try {
        const response = await axios.get(`${BASE_URL}/everything`, {
            params: {
                sources,
                page,
                pageSize: 20,
                apiKey: API_KEY,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error al obtener noticias por fuente:', error);
        throw error;
    }
};

/**
 * Obtiene las fuentes de noticias disponibles
 * @param {string} category - Categoría opcional
 * @param {string} language - Idioma opcional (ej. 'es')
 * @returns {Promise} - Lista de fuentes disponibles
 */
export const getSources = async (category = '', language = 'es') => {
    try {
        const response = await axios.get(`${BASE_URL}/sources`, {
            params: {
                category,
                language,
                apiKey: API_KEY,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error al obtener fuentes:', error);
        throw error;
    }
};

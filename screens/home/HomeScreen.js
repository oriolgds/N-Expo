import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import {
  getTopHeadlines,
  getUserRegion,
  subscribeToNewsUpdates,
  loadCachedNews,
  forceNewsUpdate
} from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

const HomeScreen = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [userRegion, setUserRegion] = useState('es');

  // Obtener la región preferida del usuario
  useEffect(() => {
    const fetchUserRegion = async () => {
      try {
        const region = await getUserRegion();
        setUserRegion(region);
      } catch (error) {
        console.error('Error al obtener la región del usuario:', error);
      }
    };

    fetchUserRegion();
  }, []);

  // Función para cargar noticias iniciales
  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);

      // Intentar cargar desde caché primero para mostrar algo rápidamente
      const cachedNews = await loadCachedNews(userRegion);

      if (cachedNews && cachedNews.articles.length > 0) {
        console.log('Usando noticias en caché para carga inicial');
        setNews(cachedNews.articles);
        setError(null);
        setLoading(false);
      }

      // Independientemente de si tenemos caché, cargar datos frescos
      const response = await getTopHeadlines(userRegion);

      if (response && Array.isArray(response.articles)) {
        setNews(response.articles);
        setHasMoreData(response.articles.length === 20);
        setError(null);
      }
    } catch (error) {
      console.error('Error cargando noticias:', error);
      if (!news.length) {
        setError('Error al cargar noticias. Intentando conectar en tiempo real...');
      }
    } finally {
      setLoading(false);
    }
  }, [userRegion]);

  // Cargar datos iniciales y configurar suscripción en tiempo real
  useEffect(() => {
    // Carga inicial
    initialLoad();

    // Configurar suscripción en tiempo real
    const unsubscribe = subscribeToNewsUpdates(userRegion, (updatedData) => {
      if (updatedData && Array.isArray(updatedData.articles)) {
        console.log('Recibida actualización automática de noticias');
        setNews(updatedData.articles);
        setError(null);
      }
    });

    // Limpiar suscripción al desmontar
    return () => unsubscribe();
  }, [userRegion, initialLoad]);

  // Manejar el pull-to-refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await forceNewsUpdate(userRegion);

      if (response && Array.isArray(response.articles)) {
        setNews(response.articles);
        setHasMoreData(response.articles.length === 20);
        setError(null);
      }
    } catch (error) {
      console.error('Error al refrescar:', error);
    } finally {
      setRefreshing(false);
    }
  }, [userRegion]);

  const handleLoadMore = async () => {
    if (loading || refreshing || !hasMoreData) return;

    try {
      const nextPage = page + 1;
      setPage(nextPage);

      const response = await getTopHeadlines(userRegion, '', nextPage);

      if (response && Array.isArray(response.articles)) {
        const newArticles = response.articles;

        // Evitar duplicados al cargar más páginas
        const existingIds = new Set(news.map(item => item.id));
        const uniqueNewArticles = newArticles.filter(article => !existingIds.has(article.id));

        setNews(prevNews => [...prevNews, ...uniqueNewArticles]);
        setHasMoreData(newArticles.length === 20);
      }
    } catch (error) {
      console.error('Error cargando más noticias:', error);
    }
  };

  const renderFooter = () => {
    if (!loading && !refreshing) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (!item || typeof item !== 'object' || !item.title) {
      return null;
    }
    return <NewsCard article={item} />;
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item?.id || `${item?.title || Math.random()}-${Math.random()}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.accent]}
              tintColor={COLORS.accent}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text>No hay noticias disponibles</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 300,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 300,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});

export default HomeScreen;

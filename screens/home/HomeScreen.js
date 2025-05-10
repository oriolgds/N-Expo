import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { getTopHeadlines, getUserRegion } from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

const HomeScreen = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
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
        // Mantenemos 'es' como valor predeterminado si hay un error
      }
    };

    fetchUserRegion();
  }, []);

  const fetchNews = async (pageNum = 1, refresh = false) => {
    if (refresh) {
      setPage(1);
      pageNum = 1;
      setNews([]);
    }

    if (!hasMoreData && pageNum > 1) return;

    try {
      setLoading(true);
      console.log(`Solicitando noticias para región: ${userRegion}, página: ${pageNum}`);
      // Usamos la región del usuario
      const response = await getTopHeadlines(userRegion, '', pageNum);

      console.log("Respuesta recibida:",
        response?.status,
        response?.articles ? `(${response.articles.length} artículos)` : '(sin artículos)',
        response?.isFallback ? '- usando fallback' : '');

      // Comprobación de seguridad para el objeto response
      if (!response) {
        throw new Error('La respuesta es nula');
      }

      // Garantizamos que response.articles sea un array
      const articles = Array.isArray(response.articles) ? response.articles : [];

      if (articles.length === 0) {
        console.log("No se encontraron artículos en la respuesta");
      } else {
        console.log(`Procesando ${articles.length} artículos`);
      }

      if (refresh || pageNum === 1) {
        setNews(articles);
      } else {
        // Evitar duplicados al cargar más páginas
        const existingIds = new Set(news.map(item => item.id));
        const uniqueNewArticles = articles.filter(article => !existingIds.has(article.id));

        setNews(prevNews => [...prevNews, ...uniqueNewArticles]);
      }

      // Si recibimos menos artículos de los esperados o hay un flag específico, asumimos que no hay más datos
      setHasMoreData(articles.length === 20 && !response.noMoreData);
      setError(null);

      // Si la respuesta vino de caché y tiene un error, mostramos una advertencia pero no un error completo
      if (response.fromCache && response.error) {
        console.warn('Usando datos en caché. Error original:', response.error);
      }

      // Si estamos usando el fallback, informamos al usuario
      if (response.isFallback) {
        console.info('Mostrando noticias de reserva debido a problemas de conexión');
      }
    } catch (error) {
      setError('Error al cargar las noticias. Por favor, intenta de nuevo más tarde.');
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNews(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMoreData) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNews(nextPage);
    }
  };

  // Refrescar noticias cuando cambia la región
  useEffect(() => {
    fetchNews(1, true);
  }, [userRegion]);

  // Cargar noticias al montar el componente
  useEffect(() => {
    fetchNews();
  }, []);

  const renderFooter = () => {
    if (!loading || refreshing) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  };

  const renderItem = ({ item }) => {
    // Verificar que el artículo sea válido antes de pasarlo a NewsCard
    if (!item || typeof item !== 'object' || !item.title) {
      console.warn('Se intentó renderizar un artículo inválido:', item);
      return null; // No renderizar nada si el artículo no es válido
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

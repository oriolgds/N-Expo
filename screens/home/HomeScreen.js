import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Animated, Image, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { ActivityIndicator, Text, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  getTopHeadlines,
  getUserRegion,
  subscribeToNewsUpdates,
  loadCachedNews,
  forceNewsUpdate
} from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

// Ajustar estas constantes para incluir el margen superior
const HEADER_MAX_HEIGHT = 60;
const HEADER_MIN_HEIGHT = 0;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;
const HEADER_MARGIN_TOP = Platform.OS === 'ios' ? 40 : 30; // Margen superior para evitar solaparse con la barra del sistema

const HomeScreen = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [userRegion, setUserRegion] = useState('es');
  const navigation = useNavigation();

  // Ref para la animación del scroll
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYClamped = Animated.diffClamp(scrollY, 0, HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT);

  const translateY = scrollYClamped.interpolate({
    inputRange: [0, HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT],
    outputRange: [0, -HEADER_MARGIN_TOP - HEADER_MAX_HEIGHT],
    extrapolate: 'clamp',
  });

  // Variable para rastrear la dirección del scroll
  const scrollDirection = useRef(new Animated.Value(0)).current;
  const clampedScrollY = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: event => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // Actualizar el valor clampedScrollY con el valor actual del scroll
        clampedScrollY.setValue(Math.min(Math.max(0, offsetY), HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT));

        // Determinar la dirección del scroll
        if (offsetY > clampedScrollY._value) {
          // Scrolling hacia abajo
          scrollDirection.setValue(1);
        } else if (offsetY < clampedScrollY._value) {
          // Scrolling hacia arriba
          scrollDirection.setValue(-1);
        }
      }
    }
  );

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

  // Navegar a la pantalla de perfil
  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={styles.container}>
      {/* Header animado que se muestra/oculta según dirección del scroll */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY }],
            marginTop: HEADER_MARGIN_TOP,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <TouchableOpacity onPress={goToProfile}>
            <IconButton
              icon="account-circle"
              size={30}
              color={COLORS.accent}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />

      {error ? (
        <View style={[styles.errorContainer, { marginTop: HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Animated.FlatList
          contentContainerStyle={{ paddingTop: HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT }}
          data={news}
          keyExtractor={(item) => item?.id || `${item?.title || Math.random()}-${Math.random()}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.accent]}
              tintColor={COLORS.accent}
              progressViewOffset={HEADER_MARGIN_TOP + HEADER_MAX_HEIGHT}
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
          // Conectar el scroll a la animación
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_MAX_HEIGHT,
    backgroundColor: COLORS.background,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    paddingTop: HEADER_MARGIN_TOP,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logo: {
    height: 40,
    width: 40,
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Animated, Image, TouchableOpacity, Platform, StatusBar, ScrollView } from 'react-native';
import { ActivityIndicator, Text, IconButton, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  getTopHeadlines,
  getUserRegion,
  subscribeToNewsUpdates,
  loadCachedNews,
  forceNewsUpdate,
  reloadNewsFromFirebase,
  NEWS_CATEGORIES
} from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

// Ajustar estas constantes para incluir el margen superior
const HEADER_HEIGHT = 60; // Altura del contenido del header
const HEADER_PADDING_TOP = Platform.OS === 'ios' ? 40 : 30; // Padding superior para evitar solaparse con la barra del sistema
const HEADER_TOTAL_HEIGHT = HEADER_HEIGHT + HEADER_PADDING_TOP; // Altura total incluyendo padding
const CATEGORY_BAR_HEIGHT = 50; // Altura de la barra de categorías

const HomeScreen = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [userRegion, setUserRegion] = useState('es');
  const [selectedCategory, setSelectedCategory] = useState('');
  const navigation = useNavigation();

  // Ref para la animación del scroll
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYClamped = Animated.diffClamp(scrollY, 0, HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT);

  const translateY = scrollYClamped.interpolate({
    inputRange: [0, HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT],
    outputRange: [0, -(HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT)],
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
        clampedScrollY.setValue(Math.min(Math.max(0, offsetY), HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT));

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
      setPage(1); // Reset page cuando cambiamos de categoría

      console.log(`Iniciando carga para categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory}`);

      // Intentar cargar desde caché primero para mostrar algo rápidamente
      const cachedNews = await loadCachedNews(userRegion, selectedCategory);

      if (cachedNews && cachedNews.articles.length > 0) {
        console.log(`Usando noticias en caché para carga inicial de categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory}`);
        setNews(cachedNews.articles);
        setError(null);
        // No establecemos loading=false aquí para evitar mostrar la UI como cargada cuando realmente
        // estamos recargando en segundo plano
      }

      // Independientemente de si tenemos caché, cargar datos frescos
      console.log(`Solicitando datos frescos para: ${selectedCategory === '' ? 'top-news' : selectedCategory}`);
      const response = await getTopHeadlines(userRegion, selectedCategory);

      if (response && Array.isArray(response.articles)) {
        console.log(`Recibidos ${response.articles.length} artículos frescos`);
        setNews(response.articles);
        setHasMoreData(response.articles.length === 20);
        setError(null);
      } else {
        console.error('La respuesta no contiene artículos válidos:', response);
      }
    } catch (error) {
      console.error('Error cargando noticias:', error);
      if (!news.length) {
        setError('Error al cargar noticias. Intentando conectar en tiempo real...');
      }
    } finally {
      console.log('Finalizando carga inicial');
      setLoading(false);
    }
  }, [userRegion, selectedCategory]);

  // Cargar datos iniciales y configurar suscripción en tiempo real cuando cambia la categoría
  useEffect(() => {
    // Carga inicial
    initialLoad();

    // Configurar suscripción en tiempo real
    const unsubscribe = subscribeToNewsUpdates(userRegion, selectedCategory, (updatedData) => {
      if (updatedData && Array.isArray(updatedData.articles)) {
        console.log(`Recibida actualización automática de noticias para categoría: ${selectedCategory || 'general'}`);
        setNews(updatedData.articles);
        setError(null);
      }
    });

    // Limpiar suscripción al desmontar
    return () => unsubscribe();
  }, [userRegion, selectedCategory, initialLoad]);

  // Manejar el pull-to-refresh
  const handleRefresh = useCallback(async () => {
    try {
      console.log(`Pull-to-refresh para categoría: ${selectedCategory || 'general'}`);
      setRefreshing(true);
      // Usamos reloadNewsFromFirebase para no consumir cuota de API
      const response = await reloadNewsFromFirebase(userRegion, selectedCategory);

      if (response && Array.isArray(response.articles)) {
        console.log(`Recibidos ${response.articles.length} artículos desde Firebase para categoría: ${response.category || selectedCategory || 'general'}`);

        setNews(response.articles);
        setHasMoreData(response.articles.length === 20);
        setError(null);
      } else {
        console.error("Error: respuesta sin artículos", response);
      }
    } catch (error) {
      console.error('Error al refrescar desde Firebase:', error);
    } finally {
      setRefreshing(false);
    }
  }, [userRegion, selectedCategory]);

  const handleLoadMore = async () => {
    if (loading || refreshing || !hasMoreData) return;

    try {
      const nextPage = page + 1;
      setPage(nextPage);

      const response = await getTopHeadlines(userRegion, selectedCategory, nextPage);

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

  const handleCategorySelect = (category) => {
    // Importante: diferenciar entre categoría "general" (con valor "general") y top-news (con valor "")
    if (category === selectedCategory) {
      // Si ya estamos en una categoría específica y hacemos clic en ella de nuevo, volver a top-news
      if (selectedCategory !== '') {
        console.log(`Deseleccionando categoría: ${selectedCategory} -> top-news`);

        // Limpiar estado y preparar para cargar top-news
        setNews([]);
        setError(null);
        setLoading(true);
        setPage(1);

        // Establecer categoría vacía para volver a top-news
        setSelectedCategory('');
      }
      return;
    }

    console.log(`Cambiando categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory} -> ${category || 'top-news'}`);

    // Primero limpiar los artículos actuales para evitar mostrar datos incorrectos
    setNews([]);
    setError(null);
    setLoading(true);

    // Reiniciar página a 1 cuando cambia la categoría
    setPage(1);

    // Cambiar la categoría (esto activará el useEffect que carga los datos)
    setSelectedCategory(category);
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

  // Renderizar chips de categorías
  const renderCategoryChips = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContentContainer}
      >
        {/* Top News (sin categoría) */}
        <Chip
          selected={selectedCategory === ''}
          onPress={() => handleCategorySelect('')}
          style={styles.categoryChip}
          textStyle={selectedCategory === '' ? styles.selectedCategoryText : styles.categoryText}
          mode={selectedCategory === '' ? 'flat' : 'outlined'}
        >
          Top News
        </Chip>

        {/* Categoría General */}
        <Chip
          selected={selectedCategory === 'general'}
          onPress={() => handleCategorySelect('general')}
          style={styles.categoryChip}
          textStyle={selectedCategory === 'general' ? styles.selectedCategoryText : styles.categoryText}
          mode={selectedCategory === 'general' ? 'flat' : 'outlined'}
        >
          {NEWS_CATEGORIES.general}
        </Chip>

        {/* Resto de categorías */}
        {Object.entries(NEWS_CATEGORIES)
          .filter(([key]) => key !== 'general')
          .map(([key, label]) => (
            <Chip
              key={key}
              selected={selectedCategory === key}
              onPress={() => handleCategorySelect(key)}
              style={styles.categoryChip}
              textStyle={selectedCategory === key ? styles.selectedCategoryText : styles.categoryText}
              mode={selectedCategory === key ? 'flat' : 'outlined'}
            >
              {label}
            </Chip>
          ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header animado que se muestra/oculta según dirección del scroll */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY }],
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
        {/* Selector de categorías */}
        {renderCategoryChips()}
      </Animated.View>

      <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />

      {error ? (
        <View style={[styles.errorContainer, { marginTop: HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Animated.FlatList
          contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT }}
          data={news}
          keyExtractor={(item) => item?.id || `${item?.title || Math.random()}-${Math.random()}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.accent]}
              tintColor={COLORS.accent}
              progressViewOffset={HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT}
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
                <Text>No hay noticias disponibles para esta categoría</Text>
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
    height: HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT,
    backgroundColor: COLORS.background,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    paddingTop: HEADER_PADDING_TOP, // Usamos paddingTop para evitar ver el fondo
  },
  headerContent: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logo: {
    height: 40,
    width: 40,
  },
  categoriesContainer: {
    height: CATEGORY_BAR_HEIGHT,
    flexGrow: 0,
  },
  categoriesContentContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  categoryChip: {
    marginHorizontal: 4,
    height: 34,
  },
  categoryText: {
    fontSize: 13,
  },
  selectedCategoryText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
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

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
  saveNewsToLocalCache,
  getTopHeadlinesOptimized,
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

  // Ref para la animación del scroll (solo se usa en móvil)
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYClamped = Animated.diffClamp(scrollY, 0, HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT);

  const translateY = scrollYClamped.interpolate({
    inputRange: [0, HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT],
    outputRange: [0, -(HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT)],
    extrapolate: 'clamp',
  });

  const scrollDirection = useRef(new Animated.Value(0)).current;
  const clampedScrollY = useRef(new Animated.Value(0)).current;

  // Solo usar el handler de scroll animado en versiones nativas
  const handleScroll = Platform.OS !== 'web'
    ? Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      {
        useNativeDriver: true,
        listener: event => {
          const offsetY = event.nativeEvent.contentOffset.y;
          clampedScrollY.setValue(Math.min(Math.max(0, offsetY), HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT));

          if (offsetY > clampedScrollY._value) {
            scrollDirection.setValue(1);
          } else if (offsetY < clampedScrollY._value) {
            scrollDirection.setValue(-1);
          }
        }
      }
    )
    : null;

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

  // Registrar un callback global para actualizar la UI cuando haya nuevos datos
  useEffect(() => {
    // Callback para cuando los datos de una categoría se actualizan
    window.categoryDataUpdatedCallback = (cacheKey, newArticles) => {
      if (!newArticles || !Array.isArray(newArticles)) return;

      // Solo actualizar si la categoría actual corresponde a la actualizada
      const currentCacheKey = `${userRegion}_${selectedCategory || 'general'}`;
      if (currentCacheKey === cacheKey) {
        console.log('✅ Actualizando UI con nuevos datos de categoría');
        setNews(newArticles);
        // No mostrar spinner de refreshing para actualizaciones en segundo plano
      }
    };

    // Callback para cuando los datos sociales se completan
    window.socialDataLoadedCallback = (cacheKey, articlesWithSocial) => {
      const currentCacheKey = `${userRegion}_${selectedCategory || 'general'}`;
      if (currentCacheKey === cacheKey) {
        console.log('✅ Actualizando UI con datos sociales');
        setNews(articlesWithSocial);
      }
    };

    // Limpieza de callbacks al desmontar
    return () => {
      window.categoryDataUpdatedCallback = null;
      window.socialDataLoadedCallback = null;
    };
  }, [userRegion, selectedCategory]);

  // Función para cargar noticias iniciales - optimizada
  const initialLoad = useCallback(async () => {
    try {
      console.log(`Iniciando carga para categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory}`);

      // Mostrar loader solo si no tenemos datos previos
      if (news.length === 0) {
        setLoading(true);
      }

      // Usar la función optimizada para obtener noticias
      const response = await getTopHeadlinesOptimized(userRegion, selectedCategory);

      if (response && Array.isArray(response.articles)) {
        const count = response.articles.length;
        console.log(`Recibidos ${count} artículos (${response.fromMemoryCache ? 'memoria' : response.fromCache ? 'caché' : 'frescos'})`);

        // Si no hay artículos, mostrar un mensaje de error
        if (count === 0) {
          setError('No hay noticias disponibles para esta categoría');
        } else {
          // Actualizar estado con los nuevos artículos
          setNews(response.articles);
          setHasMoreData(count >= 20);
          setError(null);

          // No mostrar indicador de actualización para caché en memoria
          // ya que esto sería demasiado intrusivo para una operación tan rápida
          if (response.updating && !response.fromMemoryCache) {
            console.log('Actualización en segundo plano en curso');
          }
        }
      } else {
        console.error('La respuesta no contiene artículos válidos');
        setError('Error al cargar noticias');
      }
    } catch (error) {
      console.error('Error cargando noticias:', error);
      if (news.length === 0) {
        setError('Error al cargar noticias. Intentando conectar en tiempo real...');
      }
    } finally {
      setLoading(false);
    }
  }, [userRegion, selectedCategory, news.length]);

  // Pre-cargar categorías adyacentes cuando el usuario está en una categoría
  useEffect(() => {
    if (selectedCategory) {
      // Obtener las categorías adyacentes a la actual
      const categories = Object.keys(NEWS_CATEGORIES);
      const currentIndex = categories.indexOf(selectedCategory);

      if (currentIndex !== -1) {
        // Determinar categorías adyacentes
        const prevCategory = currentIndex > 0 ? categories[currentIndex - 1] : null;
        const nextCategory = currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null;

        // Pre-cargar en segundo plano con un retraso para no interferir con la carga principal
        setTimeout(() => {
          // Para cada categoría adyacente, pre-cargar datos sin bloquear la UI
          [prevCategory, nextCategory].filter(Boolean).forEach(category => {
            console.log(`🔄 Pre-cargando categoría adyacente: ${category}`);
            getTopHeadlinesOptimized(userRegion, category, 1).catch(() => {
              // Ignorar errores en pre-carga
            });
          });
        }, 2000); // Esperar 2 segundos después de que se cargue la categoría actual
      }
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

      // Forzar actualización desde la fuente para obtener datos frescos
      const response = await getTopHeadlines(userRegion, selectedCategory, 1, true);

      if (response && Array.isArray(response.articles)) {
        console.log(`Recibidos ${response.articles.length} artículos frescos para categoría: ${selectedCategory || 'top-news'}`);
        setNews(response.articles);
        setHasMoreData(response.articles.length === 20);
        setError(null);

        // Guardar en caché local para futuras visitas
        await saveNewsToLocalCache(userRegion, selectedCategory, {
          articles: response.articles,
          totalResults: response.totalResults,
          status: response.status
        });
      } else {
        console.error("Error: respuesta sin artículos", response);
      }
    } catch (error) {
      console.error('Error al refrescar noticias:', error);
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

  // Modificar la función handleCategorySelect para evitar doble carga
  const handleCategorySelect = (category) => {
    // Si ya estamos en esta categoría, no hacer nada o volver a top-news
    if (category === selectedCategory) {
      if (selectedCategory !== '') {
        console.log(`Deseleccionando categoría: ${selectedCategory} -> top-news`);
        setSelectedCategory('');
      }
      return;
    }

    console.log(`Cambiando categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory} -> ${category || 'top-news'}`);

    // Solo mostrar loader si no hay datos en caché de memoria (cambio rápido)
    setNews([]); // Limpiar noticias actuales para evitar mostrar contenido incorrecto
    setLoading(true);
    setPage(1);
    setSelectedCategory(category);

    // Vamos a hacer una carga inmediata para mostrar resultados sin esperar al useEffect
    getTopHeadlinesOptimized(userRegion, category).then(response => {
      if (response && Array.isArray(response.articles)) {
        setNews(response.articles);
        setHasMoreData(response.articles.length >= 20);
        setError(null);
      }
      setLoading(false);
    }).catch(error => {
      console.error('Error en cambio rápido de categoría:', error);
      setLoading(false);
    });
  };

  // Optimizar el renderizado de la lista para evitar reconstrucciones innecesarias
  const renderItem = useCallback(({ item }) => {
    if (!item || typeof item !== 'object' || (!item.title && !item.isLoading)) {
      return null;
    }

    // Si es un artículo de carga, mostrar un skeleton
    if (item.isLoading) {
      return (
        <View style={styles.loadingCardContainer}>
          <View style={styles.loadingCardHeader} />
          <View style={styles.loadingCardTitle} />
          <View style={styles.loadingCardContent} />
        </View>
      );
    }

    // Evita rerenderizaciones innecesarias pasando el artículo completo
    return <NewsCard article={item} />;
  }, []);

  // Optimizar la función listEmptyComponent para no reconstruirse en cada render
  const ListEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text>No hay noticias disponibles para esta categoría</Text>
      </View>
    );
  }, [loading]);

  const renderFooter = () => {
    if (!loading && !refreshing) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  };

  // Navegar a la pantalla de perfil
  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  // Renderizar chips de categorías específicamente para web (en grid)
  const renderWebCategoryChips = () => {
    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '8px 16px',
        gap: '8px',
      }}>
        {/* Top News */}
        <Chip
          selected={selectedCategory === ''}
          onPress={() => handleCategorySelect('')}
          style={[styles.categoryChip, selectedCategory === '' ? styles.webSelectedChip : null]}
          textStyle={selectedCategory === '' ? styles.selectedCategoryText : styles.categoryText}
          mode={selectedCategory === '' ? 'flat' : 'outlined'}
        >
          Top News
        </Chip>

        {/* Todas las categorías en una fila con wrapping */}
        {Object.entries(NEWS_CATEGORIES).map(([key, label]) => (
          <Chip
            key={key}
            selected={selectedCategory === key}
            onPress={() => handleCategorySelect(key)}
            style={[styles.categoryChip, selectedCategory === key ? styles.webSelectedChip : null]}
            textStyle={selectedCategory === key ? styles.selectedCategoryText : styles.categoryText}
            mode={selectedCategory === key ? 'flat' : 'outlined'}
          >
            {label}
          </Chip>
        ))}
      </div>
    );
  };

  // Renderizado específico para plataforma web
  const renderWebView = () => {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* Header fijo para web - más compacto */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.background,
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          {/* Fila superior: Logo y perfil en línea */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 16px',
            height: '50px',
          }}>
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
          </div>

          {/* Fila inferior: Categorías en grid con wrap */}
          {renderWebCategoryChips()}
        </div>

        {/* Contenido scrolleable con margen superior reducido */}
        <div style={{
          marginTop: 110, // Altura reducida del header
          overflowY: 'auto',
          flex: 1,
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
          maxWidth: '1200px', // Limitar ancho máximo en pantallas muy grandes
          margin: '110px auto 0', // Centrar el contenido
          width: '100%',
        }}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : loading && news.length === 0 ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {news.map((item) => (
                <div key={item?.id || `${item?.title || Math.random()}-${Math.random()}`}>
                  <NewsCard article={item} />
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {(loading || refreshing) && news.length > 0 && (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          )}

          {/* Botón de cargar más */}
          {!loading && !refreshing && hasMoreData && (
            <TouchableOpacity
              style={[styles.loadMoreButton, { width: '200px', margin: '20px auto' }]}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreText}>Cargar más noticias</Text>
            </TouchableOpacity>
          )}
        </div>
      </div>
    );
  };

  // Renderizado del componente principal
  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        renderWebView()
      ) : (
        // Versión con animaciones para NATIVO (Android/iOS)
        <>
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
              ListFooterComponent={loading || refreshing ? renderFooter : null}
              ListEmptyComponent={ListEmptyComponent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              removeClippedSubviews={true}
              maxToRenderPerBatch={8}
              windowSize={10}
              updateCellsBatchingPeriod={30}
              initialNumToRender={6}
            />
          )}
        </>
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
  loadingCardContainer: {
    backgroundColor: COLORS.background,
    marginVertical: 8,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  loadingCardHeader: {
    height: 14,
    width: '40%',
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
    borderRadius: 4,
  },
  loadingCardTitle: {
    height: 20,
    width: '100%',
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
    borderRadius: 4,
  },
  loadingCardContent: {
    height: 60,
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  webHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  webContainer: {
    marginTop: HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT,
    flex: 1,
    overflow: 'auto',
    height: '100vh',
    paddingBottom: 16,
  },
  webFlatList: {
    height: '100%',
    width: '100%',
  },
  loadMoreButton: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  loadMoreText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  webSelectedChip: {
    backgroundColor: COLORS.accent + '20', // Color de acento con 20% de opacidad
    borderColor: COLORS.accent,
  },
});

export default HomeScreen;

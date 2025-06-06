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
  NEWS_CATEGORIES,
  switchCategoryFast
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
  const [cachedCategories, setCachedCategories] = useState(new Set());
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousCategoryRef = useRef('');

  // Nueva referencia para evitar cargas duplicadas
  const manualCategoryChangeRef = useRef(false);

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
      }

      // Extraer la categoría del cacheKey (formato: region_categoria)
      const category = cacheKey.split('_')[1] === 'general' ? '' : cacheKey.split('_')[1];

      // Actualizar lista de categorías cacheadas
      setCachedCategories(prev => new Set(prev).add(category));
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

  // Nueva función para precargar todas las categorías en segundo plano
  const precacheAllCategories = useCallback(async () => {
    if (backgroundLoading) return;

    try {
      setBackgroundLoading(true);
      console.log('🔄 Iniciando precarga de todas las categorías en segundo plano');

      // Primero asegurarse de que la categoría actual (top news) ya está marcada como cacheada
      setCachedCategories(prev => new Set(prev).add(''));

      // Crear un array con todas las categorías (excepto la actual que ya está cargada)
      const categoriesToLoad = Object.keys(NEWS_CATEGORIES).filter(category =>
        category !== selectedCategory
      );

      // Cargar categorías secuencialmente para no saturar la red ni la memoria
      for (const category of categoriesToLoad) {
        if (!navigator.onLine) {
          console.log('Sin conexión, deteniendo precarga');
          break;
        }

        console.log(`🔄 Precargando categoría: ${category}`);
        try {
          const response = await getTopHeadlinesOptimized(userRegion, category);
          if (response && Array.isArray(response.articles)) {
            console.log(`✅ Categoría ${category} precargada (${response.articles.length} artículos)`);
            setCachedCategories(prev => new Set(prev).add(category));
          }
        } catch (e) {
          console.log(`❌ Error al precargar categoría ${category}:`, e);
          // Continuamos con la siguiente categoría aunque haya error
        }

        // Pequeña pausa entre solicitudes para no saturar
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ Precarga de categorías completada');
    } catch (error) {
      console.error('Error en precarga de categorías:', error);
    } finally {
      setBackgroundLoading(false);
    }
  }, [userRegion, selectedCategory, backgroundLoading]);

  // Función para cargar noticias iniciales - optimizada
  const initialLoad = useCallback(async () => {
    try {
      console.log(`Iniciando carga para categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory}`);

      // Mostrar loader solo si no tenemos datos previos y la categoría no está en caché
      if (news.length === 0 && !cachedCategories.has(selectedCategory)) {
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

          // Marcar esta categoría como cargada en caché
          setCachedCategories(prev => new Set(prev).add(selectedCategory));

          // Si es la primera carga (Top News) e iniciar precarga de otras categorías
          if (selectedCategory === '' && !backgroundLoading && cachedCategories.size <= 1) {
            console.log('⏳ Programando precarga de categorías después de cargar Top News');
            // Retraso para dar tiempo a que se renderice la UI primero
            setTimeout(() => {
              precacheAllCategories();
            }, 2000);
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
  }, [userRegion, selectedCategory, news.length, cachedCategories, backgroundLoading, precacheAllCategories]);

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
    // Verificar si este cambio de categoría fue manual
    if (manualCategoryChangeRef.current) {
      // Si fue un cambio manual, no lanzar initialLoad porque ya se cargó en handleCategorySelect
      manualCategoryChangeRef.current = false;
      console.log('Omitiendo initialLoad automático después de cambio manual de categoría');
    } else {
      // Carga inicial solo cuando no es un cambio manual
      initialLoad();
    }

    // Configurar suscripción en tiempo real (esto siempre se ejecuta)
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

  // Función optimizada para manejar cambio de categoría
  const handleCategorySelect = useCallback((category) => {
    // Si ya estamos en esta categoría, no hacer nada o volver a top-news
    if (category === selectedCategory) {
      if (selectedCategory !== '') {
        console.log(`Deseleccionando categoría: ${selectedCategory} -> top-news`);
        // Marca como cambio manual antes de cambiar la categoría
        manualCategoryChangeRef.current = true;
        setSelectedCategory('');
      }
      return;
    }

    // Guardar la categoría anterior para animaciones o uso posterior
    previousCategoryRef.current = selectedCategory;

    console.log(`Cambiando categoría: ${selectedCategory === '' ? 'top-news' : selectedCategory} -> ${category || 'top-news'}`);

    // Verificar si la categoría ya está en caché
    const isCached = cachedCategories.has(category);
    console.log(`Categoría ${category || 'top-news'} ${isCached ? 'encontrada en caché' : 'no está en caché'}`);

    // Indicar que estamos en transición (para mostrar algún indicador visual si es necesario)
    setIsTransitioning(true);

    // Marcar como cambio manual antes de cambiar la categoría
    manualCategoryChangeRef.current = true;

    // Cambiar la categoría inmediatamente (no vaciamos las noticias actuales)
    setSelectedCategory(category);
    setPage(1);

    // Crear callback para recibir datos de la nueva categoría
    const categoryDataCallback = (data) => {
      if (data && Array.isArray(data.articles)) {
        // Actualizar noticias con los nuevos datos
        setNews(data.articles);
        setHasMoreData(data.articles.length >= 20);
        setError(null);

        // Marcar la categoría como cargada en caché
        setCachedCategories(prev => new Set(prev).add(category));

        // Solo mostrar loader si es una actualización y no tenemos datos en memoria
        // Mantenemos el indicador de transición para mostrar algún spinner pequeño
        if (!data.fromMemoryCache && !data.fromCache) {
          setLoading(false);
        }

        // Si es una actualización de datos ya mostrados, no desactivar el estado de transición
        if (!data.updated && !data.fromCacheWithSocial) {
          setIsTransitioning(false);
        }
      } else {
        // Error o no hay datos
        setLoading(false);
        setIsTransitioning(false);
        if (!data || !data.articles || data.articles.length === 0) {
          setError('No hay noticias disponibles para esta categoría');
        }
      }
    };

    // Usar nuestra nueva función optimizada para cambio rápido entre categorías
    switchCategoryFast(userRegion, category, categoryDataCallback)
      .catch(error => {
        console.error('Error en cambio de categoría:', error);
        setLoading(false);
        setIsTransitioning(false);
        setError('Error al cargar la categoría');
      });

    // Comenzar a mostrar un loader sutil solo después de un pequeño retraso
    // para evitar flashes en cambios rápidos entre categorías cacheadas
    const loadingTimeout = setTimeout(() => {
      // Verificamos si todavía estamos en transición después de 300ms
      if (isTransitioning) {
        // Mostrar un indicador visual pero NO vaciar los datos actuales
        setLoading(true);
      }
    }, 300);

    // Limpiar el timeout si la operación es rápida
    return () => clearTimeout(loadingTimeout);
  }, [selectedCategory, userRegion, cachedCategories, setNews, setLoading, setError]);

  // Renderizar chips de categorías para dispositivos móviles (con scroll horizontal)
  const renderCategoryChips = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContentContainer}
        style={styles.categoriesContainer}
      >
        {/* Top News */}
        <Chip
          selected={selectedCategory === ''}
          onPress={() => handleCategorySelect('')}
          style={styles.categoryChip}
          textStyle={selectedCategory === '' ? styles.selectedCategoryText : styles.categoryText}
        >
          Top News
        </Chip>

        {/* Otras categorías */}
        {Object.entries(NEWS_CATEGORIES).map(([key, label]) => (
          <Chip
            key={key}
            selected={selectedCategory === key}
            onPress={() => handleCategorySelect(key)}
            style={styles.categoryChip}
            textStyle={selectedCategory === key ? styles.selectedCategoryText : styles.categoryText}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>
    );
  };

  // Renderizar chips de categorías para web (adaptado al espacio disponible)
  const renderWebCategoryChips = (isWideScreen) => {
    return (
      <div style={{
        display: 'flex',
        flexWrap: isWideScreen ? 'nowrap' : 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        padding: '4px',
        overflowX: isWideScreen ? 'auto' : 'visible',
        flex: isWideScreen ? 1 : 'none',
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

        {/* Todas las categorías */}
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
    // Determinar si estamos en una pantalla ancha (>= 1024px)
    const isWideScreen = typeof window !== 'undefined' && window.innerWidth >= 1024;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* Header fijo para web - adaptativo según el tamaño de pantalla */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.background,
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: isWideScreen ? 'row' : 'column', // En pantalla ancha, todo en una fila
          height: isWideScreen ? '70px' : '110px', // Altura adaptativa
          alignItems: 'center',
        }}>
          {/* Contenedor flexible para logo y perfil */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: isWideScreen ? 'auto' : '100%', // En móvil ocupa todo el ancho
            marginRight: isWideScreen ? '16px' : '0', // Espacio entre logo y categorías en pantalla ancha
          }}>
            {/* Logo a la izquierda */}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Botón de perfil (solo mostrado a la derecha en móvil o al extremo derecho en desktop) */}
            {!isWideScreen && (
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <IconButton
                  icon="account-circle"
                  size={30}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            )}
          </div>

          {/* Categorías - en la misma fila en pantalla ancha */}
          <div style={{
            display: 'flex',
            flex: isWideScreen ? 1 : 'none', // Toma el espacio disponible en pantalla ancha
            overflowX: 'auto',
            width: isWideScreen ? 'auto' : '100%',
            justifyContent: isWideScreen ? 'center' : 'flex-start',
          }}>
            {renderWebCategoryChips(isWideScreen)}
          </div>

          {/* Botón de perfil en el extremo derecho (solo en pantalla ancha) */}
          {isWideScreen && (
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <IconButton
                icon="account-circle"
                size={30}
                color={COLORS.accent}
              />
            </TouchableOpacity>
          )}
        </div>

        {/* Contenido scrolleable con margen superior ajustado según layout */}
        <div style={{
          marginTop: isWideScreen ? '70px' : '110px',
          overflowY: 'auto',
          flex: 1,
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
          maxWidth: '1200px',
          margin: `${isWideScreen ? '70px' : '110px'} auto 0`,
          width: '100%',
        }}>
          {/* Indicador de transición entre categorías */}
          {isTransitioning && (
            <div style={{
              position: 'sticky',
              top: '0px',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '8px 16px',
              borderRadius: '4px',
              margin: '-8px -8px 8px -8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              backdropFilter: 'blur(5px)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={{ marginLeft: 8, color: COLORS.text }}>Actualizando categoría...</Text>
            </div>
          )}

          {/* Contenido de noticias */}
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
              gridTemplateColumns: `repeat(auto-fill, minmax(${isWideScreen ? '350px' : '300px'}, 1fr))`,
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
  transitionIndicator: {
    position: 'absolute',
    top: HEADER_TOTAL_HEIGHT + CATEGORY_BAR_HEIGHT + 8,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  transitionText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
  },
});

export default HomeScreen;

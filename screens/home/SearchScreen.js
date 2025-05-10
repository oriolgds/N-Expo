import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Searchbar, ActivityIndicator, Text } from 'react-native-paper';
import { searchNews } from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);

  const handleSearch = async (pageNum = 1, isNewSearch = true) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    if (isNewSearch) {
      setResults([]);
      setPage(1);
      pageNum = 1;
    }

    try {
      const response = await searchNews(searchQuery, pageNum);

      if (isNewSearch) {
        setResults(response.articles);
      } else {
        setResults(prevResults => [...prevResults, ...response.articles]);
      }

      // Si recibimos menos artículos de los esperados, asumimos que no hay más datos
      setHasMoreData(response.articles.length === 20);
    } catch (error) {
      setError('Error al buscar noticias. Por favor, intenta de nuevo.');
      console.error('Error searching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMoreData) {
      const nextPage = page + 1;
      setPage(nextPage);
      handleSearch(nextPage, false);
    }
  };

  const renderFooter = () => {
    if (!loading || results.length === 0) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar noticias..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        onSubmitEditing={() => handleSearch()}
        style={styles.searchBar}
        iconColor={COLORS.accent}
      />

      {loading && results.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => item.id || `${item.title}-${index}`}
          renderItem={({ item }) => <NewsCard article={item} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyContainer}>
                <Text>No se encontraron resultados para "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text>Busca noticias por palabra clave</Text>
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
  searchBar: {
    margin: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 30,
    elevation: 2,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 80,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});

export default SearchScreen;

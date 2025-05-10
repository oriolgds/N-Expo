import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { Button, Text, ActivityIndicator, Divider, Dialog, Portal, RadioButton, Card } from 'react-native-paper';
import { logoutUser, getCurrentUser, getUserData } from '../../services/firebase';
import { getSavedArticles, getUserRegion, updateUserRegion } from '../../services/newsService';
import NewsCard from '../../components/NewsCard';
import { COLORS } from '../../styles/theme';

// Lista de regiones disponibles
const REGIONS = [
  { code: 'es', name: 'España' },
  { code: 'us', name: 'Estados Unidos' },
  { code: 'mx', name: 'México' },
  { code: 'ar', name: 'Argentina' },
  { code: 'co', name: 'Colombia' },
  { code: 'fr', name: 'Francia' },
  { code: 'gb', name: 'Reino Unido' },
  { code: 'it', name: 'Italia' },
  { code: 'de', name: 'Alemania' },
];

const ProfileScreen = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedArticles, setSavedArticles] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('es');
  const [showSavedArticles, setShowSavedArticles] = useState(false);

  // Cargar datos del usuario y región
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        if (currentUser) {
          const userDataFromFirestore = await getUserData(currentUser.uid);
          const region = await getUserRegion();

          setUserData({
            ...userDataFromFirestore,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
          });

          setSelectedRegion(region);
        }
      } catch (error) {
        setError('Error al cargar los datos del usuario');
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Función para cargar artículos guardados
  const loadSavedArticles = async () => {
    try {
      setLoadingSaved(true);
      const articles = await getSavedArticles();
      setSavedArticles(articles);
      setShowSavedArticles(true);
    } catch (error) {
      console.error('Error al cargar artículos guardados:', error);
      alert('No se pudieron cargar los artículos guardados');
    } finally {
      setLoadingSaved(false);
    }
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    try {
      await logoutUser();
      // La navegación se maneja automáticamente a través de AppNavigator
    } catch (error) {
      setError('Error al cerrar sesión');
      console.error('Error logging out:', error);
    }
  };

  // Función para actualizar la región
  const handleUpdateRegion = async () => {
    try {
      await updateUserRegion(selectedRegion);
      setShowRegionDialog(false);
      // Notificar al usuario que la región se ha actualizado
      alert(`Región actualizada a ${REGIONS.find(r => r.code === selectedRegion)?.name || selectedRegion}`);
    } catch (error) {
      console.error('Error al actualizar la región:', error);
      alert('Error al actualizar la región');
    }
  };

  // Mostrar pantalla de carga
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {!showSavedArticles ? (
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: 'https://via.placeholder.com/150' }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.userName}>@{userData?.username || userData?.displayName}</Text>
            <Text style={styles.email}>{userData?.email}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Noticias guardadas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Comentarios</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Me gusta</Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.actionsContainer}>
            <Button
              icon="earth"
              mode="outlined"
              style={styles.actionButton}
              onPress={() => setShowRegionDialog(true)}
            >
              Cambiar región ({REGIONS.find(r => r.code === selectedRegion)?.name || selectedRegion})
            </Button>

            <Button
              icon="bookmark"
              mode="outlined"
              style={styles.actionButton}
              onPress={loadSavedArticles}
              loading={loadingSaved}
            >
              Noticias guardadas
            </Button>

            <Button
              icon="logout"
              mode="contained"
              style={styles.logoutButton}
              buttonColor={COLORS.error}
              onPress={handleLogout}
            >
              Cerrar sesión
            </Button>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </ScrollView>
      ) : (
        <View style={styles.container}>
          <View style={styles.savedHeader}>
            <Button
              icon="arrow-left"
              mode="contained"
              onPress={() => setShowSavedArticles(false)}
              style={styles.backButton}
            >
              Volver al perfil
            </Button>
            <Text style={styles.savedTitle}>Noticias guardadas</Text>
          </View>

          {loadingSaved ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
          ) : (
            <FlatList
              data={savedArticles}
              keyExtractor={(item) => item.id || `${item.title}-${Math.random()}`}
              renderItem={({ item }) => <NewsCard article={item} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text>No tienes noticias guardadas</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Diálogo para seleccionar región */}
      <Portal>
        <Dialog
          visible={showRegionDialog}
          onDismiss={() => setShowRegionDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Selecciona tu región</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group onValueChange={value => setSelectedRegion(value)} value={selectedRegion}>
              {REGIONS.map((region) => (
                <RadioButton.Item
                  key={region.code}
                  label={region.name}
                  value={region.code}
                  color={COLORS.accent}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRegionDialog(false)}>Cancelar</Button>
            <Button onPress={handleUpdateRegion}>Confirmar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  email: {
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  divider: {
    marginVertical: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.textSecondary,
    marginTop: 5,
    fontSize: 12,
  },
  actionsContainer: {
    padding: 15,
  },
  actionButton: {
    marginBottom: 15,
  },
  logoutButton: {
    marginTop: 15,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 10,
  },
  dialog: {
    backgroundColor: COLORS.background,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 10,
  },
  savedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 300,
  },
});

export default ProfileScreen;

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { Button, Text, ActivityIndicator, Divider } from 'react-native-paper';
import { logoutUser, getCurrentUser, getUserData } from '../../services/firebase';
import { COLORS } from '../../styles/theme';

const ProfileScreen = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const userDataFromFirestore = await getUserData(currentUser.uid);

          setUserData({
            ...userDataFromFirestore,
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
          });
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

  const handleLogout = async () => {
    try {
      await logoutUser();
      // La navegación se maneja automáticamente a través de AppNavigator
    } catch (error) {
      setError('Error al cerrar sesión');
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
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
          icon="cog"
          mode="outlined"
          style={styles.actionButton}
          onPress={() => { }}
        >
          Configuración
        </Button>

        <Button
          icon="bookmark"
          mode="outlined"
          style={styles.actionButton}
          onPress={() => { }}
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
    padding: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsContainer: {
    padding: 20,
  },
  actionButton: {
    marginBottom: 15,
    borderColor: COLORS.accent,
  },
  logoutButton: {
    marginTop: 20,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default ProfileScreen;

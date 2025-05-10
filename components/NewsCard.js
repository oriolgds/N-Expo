import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Card, Text, Button, IconButton, Divider, TextInput, ActivityIndicator } from 'react-native-paper';
import { firebase } from '../services/firebase';
import moment from 'moment';
import 'moment/locale/es';
import { COLORS } from '../styles/theme';
import { toggleLikeArticle, toggleSaveArticle } from '../services/newsService';

moment.locale('es');

const NewsCard = ({ article = {} }) => {
  // Validar que el artículo tenga la estructura mínima requerida
  if (!article || typeof article !== 'object') {
    console.warn('NewsCard recibió un artículo inválido:', article);
    return (
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text>Error al cargar el artículo</Text>
        </Card.Content>
      </Card>
    );
  }

  // Estados para manejar interacciones - con valores predeterminados seguros
  const [liked, setLiked] = useState(article?.social?.userLiked || false);
  const [likesCount, setLikesCount] = useState(article?.social?.likesCount || 0);
  const [saved, setSaved] = useState(article?.social?.isSaved || false);
  const [commentsCount, setCommentsCount] = useState(article?.social?.commentsCount || 0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Referencias a Firebase
  const database = firebase.database();
  const auth = firebase.auth();

  // Verificar si el usuario está autenticado
  const isAuthenticated = !!auth.currentUser;

  // Escuchar cambios en likes y comentarios en tiempo real
  useEffect(() => {
    if (!article?.id) return;

    const likesRef = database.ref(`article_likes/${article.id}/count`);
    const commentsRef = database.ref(`article_comments/${article.id}`);

    // Escuchar cambios en likes
    const likesListener = likesRef.on('value', (snapshot) => {
      const count = snapshot.val() || 0;
      setLikesCount(count);
    });

    // Escuchar cambios en comentarios
    const commentsListener = commentsRef.on('value', (snapshot) => {
      const commentsData = snapshot.val();
      const count = commentsData ? Object.keys(commentsData).length : 0;
      setCommentsCount(count);
    });

    // Limpiar listeners al desmontar
    return () => {
      likesRef.off('value', likesListener);
      commentsRef.off('value', commentsListener);
    };
  }, [article?.id]);

  // Verificar el estado de like del usuario actual
  useEffect(() => {
    const checkUserLike = async () => {
      if (!article?.id || !isAuthenticated) return;

      const uid = auth.currentUser.uid;
      const userLikeRef = database.ref(`article_likes/${article.id}/users/${uid}`);

      const snapshot = await userLikeRef.once('value');
      setLiked(snapshot.exists());
    };

    checkUserLike();
  }, [article?.id, isAuthenticated]);

  // Verificar si el artículo está guardado por el usuario
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!article?.id || !isAuthenticated) return;

      const uid = auth.currentUser.uid;
      const savedRef = firebase.firestore().collection('saved_articles')
        .doc(uid).collection('articles').doc(article.id);

      const doc = await savedRef.get();
      setSaved(doc.exists);
    };

    checkSavedStatus();
  }, [article?.id, isAuthenticated]);

  // Cargar comentarios
  const loadComments = async () => {
    if (!article?.id) return;

    setLoadingComments(true);

    try {
      const commentsRef = database.ref(`article_comments/${article.id}`);
      const snapshot = await commentsRef.orderByChild('timestamp').once('value');

      const commentsArray = [];
      snapshot.forEach((childSnapshot) => {
        const comment = childSnapshot.val();
        commentsArray.push({
          id: childSnapshot.key,
          ...comment
        });
      });

      // Ordenar comentarios por timestamp (más recientes primero)
      commentsArray.sort((a, b) => b.timestamp - a.timestamp);

      setComments(commentsArray);
    } catch (error) {
      console.error('Error al cargar comentarios:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Manejar like
  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para dar like a una noticia');
      return;
    }

    if (!article?.id) {
      console.error('Artículo sin ID');
      return;
    }

    setLoading(true);
    try {
      const result = await toggleLikeArticle(article.id);
      setLiked(result.liked);
    } catch (error) {
      console.error('Error al dar/quitar like:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manejar guardar artículo
  const handleToggleSave = async () => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para guardar una noticia');
      return;
    }

    setLoading(true);
    try {
      const result = await toggleSaveArticle(article);
      setSaved(result.saved);
    } catch (error) {
      console.error('Error al guardar/eliminar artículo:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar modal de comentarios
  const handleShowComments = () => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para ver los comentarios');
      return;
    }

    loadComments();
    setCommentsVisible(true);
  };

  // Agregar nuevo comentario
  const handleAddComment = async () => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para comentar');
      return;
    }

    if (!newComment.trim()) return;

    try {
      const uid = auth.currentUser.uid;
      const user = auth.currentUser;

      const commentData = {
        text: newComment.trim(),
        userId: uid,
        userName: user.displayName || 'Usuario',
        timestamp: Date.now()
      };

      // Crear una nueva entrada en la base de datos
      const commentsRef = database.ref(`article_comments/${article.id}`);
      await commentsRef.push(commentData);

      // Limpiar el campo y recargar comentarios
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error al agregar comentario:', error);
    }
  };

  const formattedDate = article.publishedAt ? moment(article.publishedAt).fromNow() : '';

  return (
    <Card style={styles.card} mode="outlined">
      {article.urlToImage && (
        <Image
          source={{ uri: article.urlToImage }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <Card.Content style={styles.content}>
        <View style={styles.sourceContainer}>
          <Text style={styles.source}>{article?.source?.name || 'Fuente desconocida'}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        <Text style={styles.title}>{article.title || 'Sin título'}</Text>

        {expanded && article.description && (
          <Text style={styles.description}>{article.description}</Text>
        )}
      </Card.Content>

      <View style={styles.actionsContainer}>
        <IconButton
          icon={liked ? "heart" : "heart-outline"}
          iconColor={liked ? COLORS.error : COLORS.textSecondary}
          size={22}
          onPress={handleToggleLike}
          disabled={loading}
        />
        {likesCount > 0 && (
          <Text style={styles.countText}>{likesCount}</Text>
        )}

        <IconButton
          icon="comment-outline"
          iconColor={COLORS.textSecondary}
          size={22}
          onPress={handleShowComments}
          disabled={loading}
        />
        {commentsCount > 0 && (
          <Text style={styles.countText}>{commentsCount}</Text>
        )}

        <IconButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          iconColor={saved ? COLORS.accent : COLORS.textSecondary}
          size={22}
          onPress={handleToggleSave}
          disabled={loading}
        />

        <View style={styles.expandButtonContainer}>
          <Button
            onPress={() => setExpanded(!expanded)}
            mode="text"
            textColor={COLORS.accent}
            compact
          >
            {expanded ? "Ver menos" : "Ver más"}
          </Button>
        </View>
      </View>

      <Divider />

      <Card.Actions>
        <Button
          mode="text"
          onPress={() => {
            // Aquí se implementaría la lógica para abrir el artículo completo
          }}
        >
          Leer artículo completo
        </Button>
      </Card.Actions>

      {/* Modal de comentarios */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comentarios</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setCommentsVisible(false)}
              />
            </View>

            <Divider />

            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : (
              <>
                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  style={styles.commentsList}
                  ListEmptyComponent={
                    <Text style={styles.emptyCommentsText}>
                      No hay comentarios. Sé el primero en comentar.
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      <Text style={styles.commentUser}>{item.userName}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                      <Text style={styles.commentDate}>
                        {moment(item.timestamp).fromNow()}
                      </Text>
                      <Divider style={styles.commentDivider} />
                    </View>
                  )}
                />

                <View style={styles.commentInputContainer}>
                  <TextInput
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder="Escribe un comentario..."
                    style={styles.commentInput}
                    right={
                      <TextInput.Icon
                        icon="send"
                        onPress={handleAddComment}
                        disabled={!newComment.trim()}
                      />
                    }
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  image: {
    height: 200,
    width: '100%',
  },
  content: {
    paddingVertical: 12,
  },
  sourceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  source: {
    fontWeight: 'bold',
    fontSize: 14,
    color: COLORS.accent,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 12,
    marginLeft: -8,
  },
  expandButtonContainer: {
    marginLeft: 'auto',
  },
  // Estilos para el modal de comentarios
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  commentsList: {
    flex: 1,
    padding: 15,
  },
  commentItem: {
    marginBottom: 15,
  },
  commentUser: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentText: {
    fontSize: 14,
    marginVertical: 5,
  },
  commentDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  commentDivider: {
    marginTop: 10,
  },
  commentInputContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentInput: {
    backgroundColor: COLORS.surface,
  },
  emptyCommentsText: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NewsCard;

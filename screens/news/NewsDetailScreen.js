import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Divider, TextInput, ActivityIndicator, Button } from 'react-native-paper';
import { firebase } from '../../services/firebase';
import moment from 'moment';
import 'moment/locale/es';
import { COLORS } from '../../styles/theme';
import { toggleLikeArticle, toggleSaveArticle } from '../../services/newsService';

moment.locale('es');

const NewsDetailScreen = ({ route, navigation }) => {
    const { article } = route.params;

    // Estados para manejar interacciones
    const [liked, setLiked] = useState(article?.social?.userLiked || false);
    const [likesCount, setLikesCount] = useState(article?.social?.likesCount || 0);
    const [saved, setSaved] = useState(article?.social?.isSaved || false);
    const [commentsCount, setCommentsCount] = useState(article?.social?.commentsCount || 0);
    const [loading, setLoading] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(true);

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

            // Cargar comentarios automáticamente
            loadComments();
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

            // Limpiar el campo
            setNewComment('');
        } catch (error) {
            console.error('Error al agregar comentario:', error);
        }
    };

    const formattedDate = article.publishedAt ? moment(article.publishedAt).format('DD MMM YYYY, HH:mm') : '';

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <IconButton
                        icon="arrow-left"
                        size={24}
                        onPress={() => navigation.goBack()}
                    />
                    <Text style={styles.headerTitle}>Noticia</Text>
                </View>

                {article.urlToImage && (
                    <Image
                        source={{ uri: article.urlToImage }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                )}

                <View style={styles.contentContainer}>
                    <View style={styles.sourceContainer}>
                        <Text style={styles.source}>{article?.source?.name || 'Fuente desconocida'}</Text>
                        <Text style={styles.date}>{formattedDate}</Text>
                    </View>

                    <Text style={styles.title}>{article.title || 'Sin título'}</Text>

                    {article.description && (
                        <Text style={styles.description}>{article.description}</Text>
                    )}

                    {article.content && (
                        <Text style={styles.content}>{article.content}</Text>
                    )}

                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleToggleLike}
                            disabled={loading}
                        >
                            <IconButton
                                icon={liked ? "heart" : "heart-outline"}
                                iconColor={liked ? COLORS.error : COLORS.textSecondary}
                                size={24}
                            />
                            <Text style={styles.actionText}>
                                {likesCount > 0 ? likesCount : ''} {likesCount === 1 ? 'Me gusta' : likesCount > 1 ? 'Me gustas' : 'Me gusta'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleToggleSave}
                            disabled={loading}
                        >
                            <IconButton
                                icon={saved ? "bookmark" : "bookmark-outline"}
                                iconColor={saved ? COLORS.accent : COLORS.textSecondary}
                                size={24}
                            />
                            <Text style={styles.actionText}>
                                {saved ? 'Guardado' : 'Guardar'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Button
                        mode="outlined"
                        onPress={() => {
                            if (article.url) {
                                // Aquí se podría abrir el navegador para ver el artículo completo
                            }
                        }}
                        style={styles.readMoreButton}
                    >
                        Leer artículo completo
                    </Button>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.commentsSection}>
                    <Text style={styles.commentsTitle}>Comentarios ({commentsCount})</Text>

                    {isAuthenticated && (
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
                    )}

                    {loadingComments ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={COLORS.accent} />
                        </View>
                    ) : comments.length === 0 ? (
                        <View style={styles.emptyCommentsContainer}>
                            <Text style={styles.emptyCommentsText}>
                                No hay comentarios. {isAuthenticated ? 'Sé el primero en comentar.' : 'Inicia sesión para comentar.'}
                            </Text>
                        </View>
                    ) : (
                        comments.map((item) => (
                            <View style={styles.commentItem} key={item.id}>
                                <Text style={styles.commentUser}>{item.userName}</Text>
                                <Text style={styles.commentText}>{item.text}</Text>
                                <Text style={styles.commentDate}>
                                    {moment(item.timestamp).fromNow()}
                                </Text>
                                <Divider style={styles.commentDivider} />
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: COLORS.background,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    image: {
        height: 250,
        width: '100%',
    },
    contentContainer: {
        padding: 15,
    },
    sourceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
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
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        marginBottom: 15,
        lineHeight: 22,
    },
    content: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        marginLeft: -5,
        color: COLORS.textSecondary,
    },
    divider: {
        marginVertical: 15,
    },
    readMoreButton: {
        marginTop: 15,
    },
    commentsSection: {
        padding: 15,
    },
    commentsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    commentInputContainer: {
        marginBottom: 15,
    },
    commentInput: {
        backgroundColor: COLORS.surface,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyCommentsContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyCommentsText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    commentItem: {
        marginBottom: 15,
        paddingVertical: 5,
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
    }
});

export default NewsDetailScreen;

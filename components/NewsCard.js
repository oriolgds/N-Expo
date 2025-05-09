import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Card, Text, Button, IconButton, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import { COLORS } from '../styles/theme';

moment.locale('es');

const NewsCard = ({ article }) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleLike = () => {
    setLiked(!liked);
    // Aquí se implementaría la lógica para guardar el "me gusta" en Firebase
  };

  const toggleSave = () => {
    setSaved(!saved);
    // Aquí se implementaría la lógica para guardar la noticia en Firebase
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
          <Text style={styles.source}>{article.source.name}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        <Text style={styles.title}>{article.title}</Text>

        {expanded && article.description && (
          <Text style={styles.description}>{article.description}</Text>
        )}
      </Card.Content>

      <View style={styles.actionsContainer}>
        <IconButton
          icon={liked ? "heart" : "heart-outline"}
          iconColor={liked ? COLORS.error : COLORS.textSecondary}
          size={22}
          onPress={toggleLike}
        />

        <IconButton
          icon="comment-outline"
          iconColor={COLORS.textSecondary}
          size={22}
          onPress={() => { }}
        />

        <IconButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          iconColor={saved ? COLORS.accent : COLORS.textSecondary}
          size={22}
          onPress={toggleSave}
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
  expandButtonContainer: {
    marginLeft: 'auto',
  },
});

export default NewsCard;

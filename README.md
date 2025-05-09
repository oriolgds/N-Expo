# N-Expo: App de Noticias Revolucionaria

N-Expo es una aplicación de noticias revolucionaria inspirada en la interfaz y experiencia de Twitter (ahora X). Esta aplicación proporciona una forma ágil y dinámica de consumir noticias de diversas fuentes, permitiendo a los usuarios interactuar con el contenido a través de comentarios y "me gusta", similar a cómo interactúan con las publicaciones en redes sociales.

## Características principales

- **Autenticación de usuarios**: Sistema completo de registro e inicio de sesión
- **Feed de noticias estilo Twitter/X**: Visualización de noticias en un formato familiar
- **Interacción social**: Capacidad para dar "me gusta" y comentar noticias
- **Búsqueda de noticias**: Encuentra noticias específicas por palabras clave
- **Guardado de noticias**: Guarda tus noticias favoritas para leer más tarde
- **Perfil de usuario personalizable**: Gestiona tu información y preferencias
- **Diseño minimalista y elegante**: Interfaz limpia con paleta de colores neutros

## Tecnologías utilizadas

- **React Native & Expo**: Framework para desarrollo multiplataforma
- **Firebase Authentication**: Gestión segura de usuarios y autenticación
- **Firebase Firestore**: Base de datos NoSQL para almacenamiento de datos
- **NewsAPI.org**: API externa para obtención de noticias en tiempo real
- **React Navigation**: Navegación fluida entre pantallas
- **React Native Paper**: Componentes de UI consistentes y elegantes

## Instalación y configuración

```bash
# Clonar el repositorio
git clone https://github.com/oriolgds/N-Expo.git

# Navegar al directorio del proyecto
cd N-Expo

# Instalar dependencias
npm install

# Iniciar la aplicación
npm start
```

## Limitaciones de la API

Esta aplicación utiliza **NewsAPI.org** para obtener datos de noticias en tiempo real. Ten en cuenta las siguientes limitaciones:

- **100 solicitudes diarias** en el plan gratuito
- Las noticias más recientes están limitadas a los últimos 30 días
- Algunos endpoints solo funcionan en desarrollo, no en producción

## Estructura de la aplicación

- **Autenticación**: Registro e inicio de sesión de usuarios
- **Feed principal**: Visualización de noticias destacadas
- **Búsqueda**: Encuentra noticias específicas por palabras clave
- **Perfil de usuario**: Gestión de información y preferencias del usuario
- **Detalle de noticia**: Vista ampliada con opciones de interacción social

## Próximas funcionalidades

- Notificaciones para noticias relevantes
- Temas personalizados (modo oscuro/claro)
- Compartir noticias en redes sociales
- Seguimiento de temas específicos
- Estadísticas de lectura

## Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes, por favor abre primero un issue para discutir lo que te gustaría cambiar.

## Licencia

MIT

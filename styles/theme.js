import { DefaultTheme } from 'react-native-paper';

export const COLORS = {
  primary: '#000000',     // Negro
  secondary: '#555555',   // Gris oscuro
  accent: '#1DA1F2',      // Azul Twitter/N
  background: '#FFFFFF',  // Blanco
  surface: '#F5F5F5',     // Gris muy claro
  text: '#000000',        // Negro
  textSecondary: '#657786', // Gris medio
  error: '#E0245E',       // Rojo
  disabled: '#AAB8C2',    // Gris claro
  placeholder: '#AAB8C2', // Gris claro
  backdrop: 'rgba(0, 0, 0, 0.5)',
};

// Definir correctamente todas las variantes de texto necesarias
export const FONTS = {
  // Variantes de fuente requeridas por React Native Paper
  regular: {
    fontFamily: 'System',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'System',
    fontWeight: '500',
  },
  light: {
    fontFamily: 'System',
    fontWeight: '300',
  },
  bold: {
    fontFamily: 'System',
    fontWeight: 'bold',
  },
  // Variantes adicionales para React Native Paper v5+
  bodyLarge: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
  },
  bodyMedium: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
  },
  bodySmall: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 12,
  },
  titleLarge: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 20,
  },
  titleMedium: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 16,
  },
  titleSmall: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 14,
  },
  labelLarge: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 14,
  },
  labelMedium: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 12,
  },
  labelSmall: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: 10,
  },
  headlineLarge: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 32,
  },
  headlineMedium: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 28,
  },
  headlineSmall: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 24,
  },
};

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  xlarge: 24,
  xxlarge: 32,
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.accent,
    background: COLORS.background,
    surface: COLORS.surface,
    text: COLORS.text,
    error: COLORS.error,
    disabled: COLORS.disabled,
    placeholder: COLORS.placeholder,
    backdrop: COLORS.backdrop,
  },
  fonts: FONTS,
  sizes: SIZES,
};

export const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 30,
  },
  textButton: {
    marginTop: 10,
  },
  title: {
    fontSize: SIZES.xlarge,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SIZES.medium,
    color: COLORS.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 30,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: 10,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
};

export default {
  COLORS,
  FONTS,
  SIZES,
  theme,
  styles,
};

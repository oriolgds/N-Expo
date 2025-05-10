import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Surface } from 'react-native-paper';
import { loginUser } from '../../services/firebase';
import { COLORS, styles as globalStyles } from '../../styles/theme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const passwordInputRef = useRef(null);

  const validateForm = () => {
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor ingresa un correo electrónico válido');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await loginUser(email, password);
      setLoading(false);
    } catch (error) {
      setLoading(false);

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Correo electrónico o contraseña incorrectos');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Por favor intenta más tarde');
      } else {
        setError('Ocurrió un error al iniciar sesión. Por favor intenta de nuevo');
        console.error(error);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.backgroundView}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Bienvenido a N</Text>
            <Text style={styles.subtitle}>Tu portal de noticias personalizado</Text>
          </View>

          <Surface style={styles.formSurface}>
            <View style={styles.formContainer}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Campo de email con enfoque personalizado */}
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <TextInput.Icon icon="email" color={COLORS.textSecondary} />
                </View>
                <TextInput
                  label="Correo electrónico"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  activeOutlineColor="#000000"
                  autoCapitalize="none"
                  mode="outlined"
                  style={styles.textInput}
                  outlineColor={COLORS.border}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                  theme={{
                    roundness: 10,
                    colors: { onSurfaceVariant: COLORS.textSecondary }
                  }}
                />
              </View>

              {/* Campo de contraseña con enfoque personalizado */}
              <View style={styles.inputContainer}>
                <View style={styles.iconContainer}>
                  <TextInput.Icon icon="lock" color={COLORS.textSecondary} />
                </View>
                <TextInput
                  ref={passwordInputRef}
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  mode="outlined"
                  style={styles.textInput}
                  outlineColor={COLORS.border}
                  activeOutlineColor="#000000"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  theme={{
                    roundness: 10,
                    colors: { onSurfaceVariant: COLORS.textSecondary }
                  }}
                />
                <TouchableOpacity
                  style={styles.rightIconContainer}
                  onPress={() => setSecureTextEntry(!secureTextEntry)}
                >
                  <TextInput.Icon
                    icon={secureTextEntry ? "eye" : "eye-off"}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.button}
                disabled={loading}
                buttonColor={COLORS.primary}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.background} size={24} />
                ) : (
                  'Iniciar sesión'
                )}
              </Button>

              <TouchableOpacity
                onPress={() => { }} // Implementar recuperación de contraseña
                style={styles.forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>O</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                style={styles.registerButton}
              >
                <Text style={styles.registerText}>¿No tienes una cuenta? <Text style={styles.registerTextBold}>Regístrate</Text></Text>
              </TouchableOpacity>
            </View>
          </Surface>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundView: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.primary, // Color sólido en lugar de gradiente
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paViewg: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  formSurface: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    elevation: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  formContainer: {
    width: '100%',
    padding: 25,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 87, 87, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: COLORS.background,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'absolute',
    left: 8,
    zIndex: 1,
    height: '100%',
    justifyContent: 'center',
    marginTop: 6,
  },
  rightIconContainer: {
    position: 'absolute',
    right: 8,
    zIndex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    marginTop: 6,

  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingLeft: 26,// Espacio para el icono derecho
    paddingRight: 30, // Espacio para el icono izquierdo
  },
  inputContent: {
    fontSize: 16,
    paddingLeft: 8, // Espacio adicional en el texto
  },
  button: {
    marginTop: 20,
    borderRadius: 10,
    elevation: 3,
  },
  buttonContent: {
    height: 50,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: COLORS.textSecondary,
  },
  registerButton: {
    alignItems: 'center',
    padding: 10,
  },
  registerText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  registerTextBold: {
    fontWeight: 'bold',
    color: COLORS.accent,
  },
});

export default LoginScreen;

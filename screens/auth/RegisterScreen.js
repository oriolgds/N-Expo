import React, { useState, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import { registerUser } from '../../services/firebase';
import { COLORS, styles as globalStyles } from '../../styles/theme';

const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);

  // Referencias para los campos del formulario
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const validateForm = () => {
    if (!username || !email || !password || !confirmPassword) {
      setError('Por favor completa todos los campos');
      return false;
    }

    if (username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor ingresa un correo electrónico válido');
      return false;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await registerUser(email, password, username);
      setLoading(false);
      // La redirección ocurrirá automáticamente por los listeners de autenticación
    } catch (error) {
      setLoading(false);
      console.error("Error completo:", error);

      if (error.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está en uso');
      } else if (error.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido');
      } else if (error.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil');
      } else if (error.message && error.message.includes('Firestore')) {
        // Capturar errores específicos de Firestore
        setError('Error al guardar los datos del usuario. Por favor intenta de nuevo.');
      } else {
        setError('Ocurrió un error al registrar el usuario');
        console.error('Error durante el registro:', error);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Únete a N</Text>
            <Text style={styles.subtitle}>Crea una cuenta para comenzar</Text>
          </View>

          <View style={styles.formContainer}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Campo de nombre de usuario con enfoque personalizado */}
            <View style={styles.inputContainer}>
              <View style={styles.iconContainer}>
                <TextInput.Icon icon="account" color={COLORS.textSecondary} />
              </View>
              <TextInput
                label="Nombre de usuario"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                mode="outlined"
                style={styles.textInput}
                outlineColor={COLORS.border}
                activeOutlineColor="#000000"
                returnKeyType="next"
                onSubmitEditing={() => emailInputRef.current?.focus()}
                blurOnSubmit={false}
                theme={{
                  roundness: 10,
                  colors: { onSurfaceVariant: COLORS.textSecondary }
                }}
              />
            </View>

            {/* Campo de email con enfoque personalizado */}
            <View style={styles.inputContainer}>
              <View style={styles.iconContainer}>
                <TextInput.Icon icon="email" color={COLORS.textSecondary} />
              </View>
              <TextInput
                ref={emailInputRef}
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                mode="outlined"
                style={styles.textInput}
                outlineColor={COLORS.border}
                activeOutlineColor="#000000"
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
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                blurOnSubmit={false}
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

            {/* Campo de confirmar contraseña con enfoque personalizado */}
            <View style={styles.inputContainer}>
              <View style={styles.iconContainer}>
                <TextInput.Icon icon="lock-check" color={COLORS.textSecondary} />
              </View>
              <TextInput
                ref={confirmPasswordInputRef}
                label="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={secureConfirmTextEntry}
                mode="outlined"
                style={styles.textInput}
                outlineColor={COLORS.border}
                activeOutlineColor="#000000"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                theme={{
                  roundness: 10,
                  colors: { onSurfaceVariant: COLORS.textSecondary }
                }}
              />
              <TouchableOpacity
                style={styles.rightIconContainer}
                onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
              >
                <TextInput.Icon
                  icon={secureConfirmTextEntry ? "eye" : "eye-off"}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Button
              mode="contained"
              onPress={handleRegister}
              style={styles.button}
              disabled={loading}
              buttonColor={COLORS.primary}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.background} size={20} />
              ) : (
                'Registrarse'
              )}
            </Button>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.linkContainer}
            >
              <Text style={styles.linkText}>¿Ya tienes una cuenta? Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.background,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
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
    paddingLeft: 26,
    paddingRight: 30,
  },
  button: {
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 30,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center',
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  linkText: {
    color: COLORS.accent,
    fontSize: 16,
  },
});

export default RegisterScreen;

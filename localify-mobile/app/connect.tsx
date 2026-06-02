import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';
import { saveServerUrl } from '../hooks/useServer';
import { usePlayerStore } from '../store/playerStore';

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    inner: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      justifyContent: 'center',
      gap: Spacing.md,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    logoIcon: {
      fontSize: 56,
    },
    logoText: {
      color: Colors.accent,
      fontSize: FontSize.xxl,
      fontWeight: '700',
      letterSpacing: 1,
    },
    title: {
      color: Colors.text,
      fontSize: FontSize.xxl,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      color: Colors.textMuted,
      fontSize: FontSize.md,
      textAlign: 'center',
      lineHeight: 22,
    },
    input: {
      backgroundColor: Colors.surfaceElevated,
      color: Colors.text,
      fontSize: FontSize.base,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      marginTop: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.surface,
    },
    error: {
      color: '#ef4444',
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    button: {
      backgroundColor: Colors.accent,
      borderRadius: Radius.full,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: Colors.background,
      fontSize: FontSize.base,
      fontWeight: '700',
    },
  }), [Colors]);
}

export default function ConnectScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const setBaseUrl = usePlayerStore((s) => s.setBaseUrl);
  const [input, setInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a server address.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    const url = trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;

    try {
      const res = await fetch(`${url}/api/tracks`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const saved = await saveServerUrl(trimmed);
      setBaseUrl(saved);
      router.replace('/(tabs)');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not connect to server.';
      setError(
        `Connection failed: ${message}\n\nMake sure Localify is running and the address is correct.`
      );
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo / icon */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🎵</Text>
          <Text style={styles.logoText}>Localify</Text>
        </View>

        <Text style={styles.title}>Connect to Localify</Text>
        <Text style={styles.subtitle}>
          Enter the IP address shown in the Localify desktop app under Settings → Remote Streaming
        </Text>

        {/* Input */}
        <TextInput
          style={styles.input}
          placeholder="192.168.1.5:3847"
          placeholderTextColor={Colors.textDim}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={handleConnect}
        />

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Connect button */}
        <TouchableOpacity
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={handleConnect}
          activeOpacity={0.8}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

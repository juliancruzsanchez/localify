import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import { useServer } from '../../hooks/useServer';
import { useConnectionStore } from '../../store/connectionStore';
import { BUILT_IN_THEMES, useThemeStore } from '../../store/themeStore';

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingBottom: 48,
    },
    header: {
      paddingTop: 56,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.lg,
    },
    title: {
      color: Colors.text,
      fontSize: FontSize.xxxl,
      fontWeight: '700',
    },
    sectionLabel: {
      color: Colors.textDim,
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 1.2,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: Colors.surfaceElevated,
      marginHorizontal: Spacing.md,
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    serverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    statusDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      flexShrink: 0,
    },
    serverLabel: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontWeight: '600',
    },
    serverUrl: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    editChip: {
      backgroundColor: Colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    editChipText: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    inputLabel: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginBottom: 2,
    },
    input: {
      backgroundColor: Colors.surface,
      color: Colors.text,
      fontSize: FontSize.base,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    error: {
      color: '#ef4444',
      fontSize: FontSize.sm,
    },
    editActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    cancelBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.textDim,
    },
    cancelBtnText: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    saveBtn: {
      backgroundColor: Colors.accent,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      minWidth: 100,
      alignItems: 'center',
    },
    saveBtnText: {
      color: Colors.background,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    reconnectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    reconnectText: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    destructiveRow: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      marginTop: Spacing.xs,
    },
    destructiveText: {
      color: '#ef4444',
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    menuCard: {
      backgroundColor: Colors.surfaceElevated,
      marginHorizontal: Spacing.md,
      borderRadius: Radius.md,
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      gap: Spacing.md,
    },
    menuRowText: {
      color: Colors.text,
      fontSize: FontSize.base,
      flex: 1,
    },
    menuRowMeta: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    themeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      flexWrap: 'wrap',
    },
    themeSwatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeSwatchActive: {
      borderColor: Colors.accent,
    },
  }), [Colors]);
}

function stripScheme(url: string | null): string {
  return url ? url.replace(/^https?:\/\//, '') : '';
}

export default function SettingsScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const { baseUrl, isOffline, isChecking, localUrl, publicUrl, reconnect } = useServer();
  const saveUrls = useConnectionStore((s) => s.saveUrls);
  const clearUrls = useConnectionStore((s) => s.clear);
  const [editing, setEditing] = useState(false);
  const [localInput, setLocalInput] = useState('');
  const [publicInput, setPublicInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    setLocalInput(stripScheme(localUrl));
    setPublicInput(stripScheme(publicUrl));
  }, [localUrl, publicUrl, editing]);

  const statusColor = baseUrl ? Colors.accent : isChecking ? Colors.textMuted : Colors.error;
  const statusLabel = isChecking
    ? 'Connecting…'
    : baseUrl
      ? 'Connected'
      : isOffline
        ? 'Offline'
        : 'Not connected';

  async function handleSave() {
    const local = localInput.trim();
    const pub = publicInput.trim();
    if (!local && !pub) {
      setError('Enter a local or public server address.');
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const reachable = await saveUrls(local, pub);
      setEditing(false);
      if (!reachable) {
        setError("Saved, but neither address is reachable right now.");
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleReconnect() {
    setError(null);
    const ok = await reconnect();
    if (!ok) setError('Still unable to reach the server.');
  }

  function handleDisconnect() {
    Alert.alert('Disconnect', 'Remove the saved server addresses?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearUrls();
          setEditing(false);
          router.replace('/connect');
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Server */}
        <Text style={styles.sectionLabel}>SERVER</Text>
        <View style={styles.card}>
          {!editing ? (
            <View style={{ gap: Spacing.sm }}>
              <View style={styles.serverRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.serverLabel}>{statusLabel}</Text>
                  <Text style={styles.serverUrl} numberOfLines={1}>
                    {baseUrl ?? localUrl ?? publicUrl ?? 'No server configured'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editChip}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editChipText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {(localUrl || publicUrl) && (
                <TouchableOpacity
                  style={[styles.reconnectBtn, isChecking && { opacity: 0.6 }]}
                  onPress={handleReconnect}
                  disabled={isChecking}
                  activeOpacity={0.8}
                >
                  {isChecking ? (
                    <ActivityIndicator color={Colors.text} size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={15} color={Colors.text} />
                      <Text style={styles.reconnectText}>Reconnect</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              <Text style={styles.inputLabel}>Local address (home Wi-Fi)</Text>
              <TextInput
                style={styles.input}
                placeholder="192.168.1.5:47823"
                placeholderTextColor={Colors.textDim}
                value={localInput}
                onChangeText={(t) => {
                  setLocalInput(t);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                autoFocus
              />

              <Text style={[styles.inputLabel, { marginTop: Spacing.xs }]}>
                Public address (away from home)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="myhome.example.com:47823"
                placeholderTextColor={Colors.textDim}
                value={publicInput}
                onChangeText={(t) => {
                  setPublicInput(t);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, isConnecting && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={isConnecting}
                  activeOpacity={0.8}
                >
                  {isConnecting ? (
                    <ActivityIndicator color={Colors.background} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save & Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {(localUrl || publicUrl) && !editing && (
          <TouchableOpacity
            style={styles.destructiveRow}
            onPress={handleDisconnect}
            activeOpacity={0.7}
          >
            <Text style={styles.destructiveText}>Disconnect from server</Text>
          </TouchableOpacity>
        )}

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>APPEARANCE</Text>
        <View style={styles.menuCard}>
          <View style={styles.themeRow}>
            {BUILT_IN_THEMES.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                onPress={() => setTheme(theme.id)}
                activeOpacity={0.75}
                style={[
                  styles.themeSwatch,
                  { backgroundColor: theme.colors.accent },
                  activeThemeId === theme.id && styles.themeSwatchActive,
                ]}
              >
                {activeThemeId === theme.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.background} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Listening */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>LISTENING</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/stats')}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.menuRowText}>Your Stats</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>ABOUT</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuRow}>
            <Ionicons name="musical-notes-outline" size={20} color={Colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuRowText}>Localify</Text>
              <Text style={styles.menuRowMeta}>Your local music, everywhere</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

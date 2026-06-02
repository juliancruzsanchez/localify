import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';
import { useServer } from '../hooks/useServer';

function useStyles() {
  const Colors = useColors();
  return useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          backgroundColor: Colors.surfaceElevated,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Colors.border,
          paddingHorizontal: Spacing.md,
          paddingBottom: Spacing.sm,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
        },
        textWrap: {
          flex: 1,
        },
        title: {
          color: Colors.text,
          fontSize: FontSize.sm,
          fontWeight: '700',
        },
        subtitle: {
          color: Colors.textMuted,
          fontSize: FontSize.xs,
          marginTop: 1,
        },
        actionBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: Colors.border,
          backgroundColor: Colors.surface,
        },
        actionText: {
          color: Colors.text,
          fontSize: FontSize.xs,
          fontWeight: '700',
        },
      }),
    [Colors],
  );
}

export function ConnectionBanner() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOffline, isChecking, reconnect } = useServer();

  // Only surface the banner while reconnecting or when offline.
  if (!isOffline && !isChecking) return null;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.row}>
        <Ionicons
          name={isChecking ? 'sync' : 'cloud-offline'}
          size={18}
          color={isChecking ? Colors.textMuted : Colors.error}
        />
        <View style={styles.textWrap}>
          <Text style={styles.title}>
            {isChecking ? 'Reconnecting…' : "You're offline"}
          </Text>
          <Text style={styles.subtitle}>
            {isChecking ? 'Looking for your server' : 'Showing downloaded music only'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => reconnect()}
          disabled={isChecking}
          activeOpacity={0.7}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <>
              <Ionicons name="refresh" size={13} color={Colors.text} />
              <Text style={styles.actionText}>Reconnect</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="link" size={13} color={Colors.text} />
          <Text style={styles.actionText}>Change URL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

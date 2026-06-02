import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, FontSize, Spacing } from '../constants/theme';

interface Props {
  artworkUri: string | null;
  name: string;
  size?: number;
  onPress?: () => void;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      marginRight: Spacing.md,
      alignItems: 'center',
    },
    artworkWrap: {
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    artwork: {
      width: '100%',
      height: '100%',
    },
    name: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontWeight: '600',
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    role: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
      textAlign: 'center',
    },
  }), [Colors]);
}

export function ArtistCard({ artworkUri, name, size = 130, onPress }: Props) {
  const styles = useStyles();
  const Colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.container, { width: size }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.artworkWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        {artworkUri ? (
          <Image source={artworkUri} style={styles.artwork} contentFit="cover" transition={200} />
        ) : (
          <Ionicons name="person" size={size * 0.4} color={Colors.textMuted} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.role}>Artist</Text>
    </TouchableOpacity>
  );
}

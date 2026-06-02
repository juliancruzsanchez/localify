import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';

interface Props {
  artworkUri: string | null;
  title: string;
  subtitle?: string;
  size?: number;
  onPress?: () => void;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      marginRight: Spacing.md,
    },
    artwork: {
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceElevated,
    },
    title: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontWeight: '600',
      marginTop: Spacing.sm,
    },
    subtitle: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
  }), [Colors]);
}

export function AlbumCard({ artworkUri, title, subtitle, size = 150, onPress }: Props) {
  const styles = useStyles();
  return (
    <TouchableOpacity style={[styles.container, { width: size }]} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={artworkUri ?? undefined}
        style={[styles.artwork, { width: size, height: size }]}
        contentFit="cover"
        transition={200}
      />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

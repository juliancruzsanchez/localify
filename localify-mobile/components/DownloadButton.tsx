import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors, FontSize } from '../constants/theme';
import { useDownloadStore } from '../store/downloadStore';
import { usePlayerStore } from '../store/playerStore';
import type { TrackSummary } from '../hooks/useLibrary';

interface Props {
  track: TrackSummary;
  size?: number;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 28,
      minHeight: 28,
    },
    pct: {
      color: Colors.accent,
      marginTop: 1,
    },
  }), [Colors]);
}

export function DownloadButton({ track, size = 18 }: Props) {
  const styles = useStyles();
  const Colors = useColors();
  const baseUrl  = usePlayerStore((s) => s.baseUrl);
  const status   = useDownloadStore((s) => s.getStatus(track.id));
  const progress = useDownloadStore((s) => s.progress[track.id] ?? 0);
  const download = useDownloadStore((s) => s.downloadTrack);
  const remove   = useDownloadStore((s) => s.deleteDownload);

  if (status === 'downloading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.accent} />
        <Text style={[styles.pct, { fontSize: FontSize.xs }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    );
  }

  if (status === 'downloaded') {
    return (
      <TouchableOpacity
        onPress={() => remove(track.id)}
        hitSlop={10}
        style={styles.container}
        accessibilityLabel="Delete download"
      >
        <Ionicons name="checkmark-circle" size={size} color={Colors.accent} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => baseUrl && download(track, baseUrl)}
      hitSlop={10}
      style={styles.container}
      disabled={!baseUrl}
      accessibilityLabel="Download for offline"
    >
      {status === 'error' ? (
        <Ionicons name="warning-outline" size={size} color={Colors.error} />
      ) : (
        <Ionicons name="arrow-down-outline" size={size} color={Colors.textDim} />
      )}
    </TouchableOpacity>
  );
}

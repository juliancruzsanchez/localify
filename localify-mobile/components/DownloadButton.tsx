import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize } from '../constants/theme';
import { useDownloadStore } from '../store/downloadStore';
import { usePlayerStore } from '../store/playerStore';
import type { TrackSummary } from '../hooks/useLibrary';

interface Props {
  track: TrackSummary;
  size?: number;
}

export function DownloadButton({ track, size = 18 }: Props) {
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
        <Text style={[styles.icon, { fontSize: size, color: Colors.accent }]}>⬇</Text>
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
      <Text
        style={[
          styles.icon,
          {
            fontSize: size,
            color: status === 'error' ? Colors.error : Colors.textDim,
          },
        ]}
      >
        {status === 'error' ? '⚠' : '⬇'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
  icon: {
    textAlign: 'center',
  },
  pct: {
    color: Colors.accent,
    marginTop: 1,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DownloadButton } from '../../components/DownloadButton';
import { FilterPills, Pill } from '../../components/FilterPills';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useLibrarySnapshot } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { useDownloadStore } from '../../store/downloadStore';
import { usePlayerStore } from '../../store/playerStore';
import type { AlbumSummary, ArtistSummary, PlaylistSummary, TrackSummary } from '../../hooks/useLibrary';

const PILLS: Pill[] = [
  { id: 'all', label: 'All' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'songs', label: 'Songs' },
  { id: 'downloads', label: 'Downloads' },
];

type FilterId = 'all' | 'playlists' | 'albums' | 'artists' | 'songs' | 'downloads';

export default function LibraryScreen() {
  const router = useRouter();
  const { baseUrl } = useServer();
  const [filter, setFilter] = useState<FilterId>('all');
  const downloads = useDownloadStore((s) => s.downloads);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const downloadedTracks = Object.values(downloads).map((d) => d.metadata);

  const { data: snapshot, isLoading } = useLibrarySnapshot();

  const playlists = snapshot?.playlists ?? [];
  const albums    = snapshot?.albums    ?? [];
  const artists   = snapshot?.artists   ?? [];
  const songs     = snapshot?.tracks    ?? [];

  const showLoading = isLoading && filter !== 'downloads';

  // ── Renderers ────────────────────────────────────────────────────────────────

  function renderPlaylist({ item }: { item: PlaylistSummary }) {
    const artwork = item.id !== 'liked' ? artworkUrl(baseUrl, item.id) : null;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/playlist/${item.id}`)}
        activeOpacity={0.7}
      >
        {item.id === 'liked' ? (
          <LinearGradient colors={['#4a148c', '#7b1fa2']} style={styles.rowArtwork}>
            <Text style={styles.likedIcon}>♥</Text>
          </LinearGradient>
        ) : (
          <Image
            source={artwork ?? undefined}
            style={styles.rowArtwork}
            contentFit="cover"
            transition={150}
          />
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowMeta}>Playlist · {item.track_count} songs</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderAlbum({ item }: { item: AlbumSummary }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/album/${item.id}`)}
        activeOpacity={0.7}
      >
        <Image
          source={artworkUrl(baseUrl, item.id) ?? undefined}
          style={styles.rowArtwork}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowMeta}>Album · {item.artist}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderArtist({ item }: { item: ArtistSummary }) {
    const initials = item.name.slice(0, 2).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/artist/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.artistCircle}>
          <Text style={styles.artistInitials}>{initials}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowMeta}>Artist · {item.album_count} albums</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderSong({ item }: { item: TrackSummary }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => playTrack(item, songs)}
        activeOpacity={0.7}
      >
        <Image
          source={artworkUrl(baseUrl, item.id) ?? undefined}
          style={styles.rowArtwork}
          contentFit="cover"
          transition={100}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowMeta}>{item.artist}</Text>
        </View>
        <DownloadButton track={item} size={16} />
      </TouchableOpacity>
    );
  }

  function renderDownloadedTrack({ item }: { item: TrackSummary }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => playTrack(item, downloadedTracks)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowArtwork, styles.trackIconBox]}>
          <Text style={styles.trackIcon}>♪</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowMeta}>{item.artist}</Text>
        </View>
        <DownloadButton track={item} size={16} />
      </TouchableOpacity>
    );
  }

  function listData(): Array<{ type: string; item: PlaylistSummary | AlbumSummary | ArtistSummary | TrackSummary }> {
    if (filter === 'downloads') return downloadedTracks.map((item) => ({ type: 'download', item }));
    if (filter === 'albums')    return albums.map((item) => ({ type: 'album', item }));
    if (filter === 'artists')   return artists.map((item) => ({ type: 'artist', item }));
    if (filter === 'songs')     return songs.map((item) => ({ type: 'song', item }));

    const liked: PlaylistSummary = { id: 'liked', name: 'Liked Songs', track_count: 0 };
    const playlistItems = [liked, ...playlists].map((item) => ({ type: 'playlist', item }));
    if (filter === 'playlists') return playlistItems;

    const albumItems = albums.map((item) => ({ type: 'album', item }));
    return [...playlistItems, ...albumItems];
  }

  const data = listData();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/stats')} hitSlop={12}>
            <Ionicons name="stats-chart-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/search')} hitSlop={12}>
            <Ionicons name="search-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pills */}
      <FilterPills pills={PILLS} selected={filter} onSelect={(id) => setFilter(id as FilterId)} />

      {/* Downloads header */}
      {filter === 'downloads' && (
        <View style={styles.downloadsHeader}>
          <Text style={styles.downloadsCount}>
            {downloadedTracks.length} {downloadedTracks.length === 1 ? 'song' : 'songs'} downloaded
          </Text>
        </View>
      )}

      {/* Songs count */}
      {filter === 'songs' && songs.length > 0 && (
        <View style={styles.downloadsHeader}>
          <Text style={styles.downloadsCount}>{songs.length} songs in library</Text>
        </View>
      )}

      {/* List */}
      {showLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : filter === 'downloads' && downloadedTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⬇</Text>
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the download icon on any track to save it for offline playback
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(entry, i) => `${entry.type}-${(entry.item as { id: string }).id}-${i}`}
          renderItem={({ item: entry }) => {
            if (entry.type === 'album')    return renderAlbum({ item: entry.item as AlbumSummary });
            if (entry.type === 'artist')   return renderArtist({ item: entry.item as ArtistSummary });
            if (entry.type === 'download') return renderDownloadedTrack({ item: entry.item as TrackSummary });
            if (entry.type === 'song')     return renderSong({ item: entry.item as TrackSummary });
            return renderPlaylist({ item: entry.item as PlaylistSummary });
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  loader: {
    marginTop: Spacing.xxl,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  rowArtwork: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  likedIcon: {
    color: Colors.text,
    fontSize: 24,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  rowMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  artistCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  artistInitials: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  trackIconBox: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIcon: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
  },
  downloadsHeader: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  downloadsCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    color: Colors.textDim,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});

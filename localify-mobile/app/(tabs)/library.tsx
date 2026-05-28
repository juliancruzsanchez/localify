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
import { artworkUrl, useAlbums, useArtists, usePlaylists } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { useDownloadStore } from '../../store/downloadStore';
import { usePlayerStore } from '../../store/playerStore';
import type { AlbumSummary, ArtistSummary, PlaylistSummary, TrackSummary } from '../../hooks/useLibrary';

const PILLS: Pill[] = [
  { id: 'all', label: 'All' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'downloads', label: 'Downloads' },
];

type FilterId = 'all' | 'playlists' | 'albums' | 'artists' | 'downloads';

export default function LibraryScreen() {
  const router = useRouter();
  const { baseUrl } = useServer();
  const [filter, setFilter] = useState<FilterId>('all');
  const downloads = useDownloadStore((s) => s.downloads);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const downloadedTracks = Object.values(downloads).map((d) => d.metadata);

  const { data: playlists, isLoading: playlistsLoading } = usePlaylists();
  const { data: albums, isLoading: albumsLoading } = useAlbums();
  const { data: artists, isLoading: artistsLoading } = useArtists();

  const isLoading =
    filter !== 'downloads' && (
      (filter === 'all' && (playlistsLoading || albumsLoading)) ||
      (filter === 'playlists' && playlistsLoading) ||
      (filter === 'albums' && albumsLoading) ||
      (filter === 'artists' && artistsLoading)
    );

  function renderPlaylist({ item }: { item: PlaylistSummary }) {
    const artwork = item.id !== 'liked' ? artworkUrl(baseUrl, item.id) : null;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/playlist/${item.id}`)}
        activeOpacity={0.7}
      >
        {item.id === 'liked' ? (
          <LinearGradient
            colors={['#4a148c', '#7b1fa2']}
            style={styles.rowArtwork}
          >
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
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta}>Playlist · {item.track_count} songs</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderAlbum({ item }: { item: AlbumSummary }) {
    const artwork = artworkUrl(baseUrl, item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/album/${item.id}`)}
        activeOpacity={0.7}
      >
        <Image
          source={artwork ?? undefined}
          style={styles.rowArtwork}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowMeta}>
            Album · {item.artist}
          </Text>
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
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta}>Artist</Text>
        </View>
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
    if (filter === 'downloads') {
      return downloadedTracks.map((item) => ({ type: 'download', item }));
    }
    if (filter === 'albums') {
      return (albums ?? []).map((item) => ({ type: 'album', item }));
    }
    if (filter === 'artists') {
      return (artists ?? []).map((item) => ({ type: 'artist', item }));
    }
    const liked: PlaylistSummary = { id: 'liked', name: 'Liked Songs', track_count: 0 };
    const playlistItems = [liked, ...(playlists ?? [])].map((item) => ({
      type: 'playlist',
      item,
    }));
    if (filter === 'playlists') return playlistItems;
    const albumItems = (albums ?? []).map((item) => ({ type: 'album', item }));
    return [...playlistItems, ...albumItems];
  }

  const data = listData();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.searchIcon}>🔍</Text>
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

      {/* List */}
      {isLoading ? (
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
            if (entry.type === 'album') return renderAlbum({ item: entry.item as AlbumSummary });
            if (entry.type === 'artist') return renderArtist({ item: entry.item as ArtistSummary });
            if (entry.type === 'download') return renderDownloadedTrack({ item: entry.item as TrackSummary });
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
  searchIcon: {
    fontSize: 22,
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

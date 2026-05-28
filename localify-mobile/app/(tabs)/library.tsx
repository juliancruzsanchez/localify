import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DownloadButton } from '../../components/DownloadButton';
import { FilterPills, Pill } from '../../components/FilterPills';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
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
type ViewMode = 'list' | 'grid';

const GRID_COLS = 3;
const GRID_PADDING = Spacing.sm;
const GRID_GAP = Spacing.sm;
const GRID_ITEM_SIZE =
  (Dimensions.get('window').width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    avatarBtn: {
      flexShrink: 0,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: Colors.text,
      fontSize: FontSize.xl,
      fontWeight: '700',
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      alignItems: 'center',
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sortText: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600',
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
      paddingVertical: 10,
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
    countText: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.sm,
    },
    emptyTitle: {
      color: Colors.text,
      fontSize: FontSize.xl,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    emptySubtitle: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    gridContent: {
      paddingHorizontal: GRID_PADDING,
      paddingBottom: Spacing.xxl,
    },
    gridRow: {
      justifyContent: 'flex-start',
      gap: GRID_GAP,
      marginBottom: Spacing.md,
    },
    gridItem: {
      width: GRID_ITEM_SIZE,
      alignItems: 'flex-start',
    },
    gridArtwork: {
      width: GRID_ITEM_SIZE,
      height: GRID_ITEM_SIZE,
      borderRadius: Radius.sm,
      backgroundColor: Colors.surfaceElevated,
      marginBottom: 6,
    },
    gridTitle: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '500',
    },
    gridMeta: {
      color: Colors.textMuted,
      fontSize: FontSize.xs,
      marginTop: 2,
    },
  }), [Colors]);
}

export default function LibraryScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const { baseUrl } = useServer();
  const [filter, setFilter] = useState<FilterId>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const downloads = useDownloadStore((s) => s.downloads);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const downloadedTracks = Object.values(downloads).map((d) => d.metadata);

  const { data: snapshot, isLoading } = useLibrarySnapshot();

  const playlists = snapshot?.playlists ?? [];
  const albums    = snapshot?.albums    ?? [];
  const artists   = snapshot?.artists   ?? [];
  const songs     = snapshot?.tracks    ?? [];

  const showLoading = isLoading && filter !== 'downloads';
  const canGrid = filter === 'albums' || filter === 'all';

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
            <Ionicons name="heart" size={22} color={Colors.text} />
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
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textDim} />
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
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textDim} />
      </TouchableOpacity>
    );
  }

  function renderAlbumGrid({ item }: { item: AlbumSummary }) {
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/album/${item.id}`)}
        activeOpacity={0.7}
      >
        <Image
          source={artworkUrl(baseUrl, item.id) ?? undefined}
          style={styles.gridArtwork}
          contentFit="cover"
          transition={150}
        />
        <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.gridMeta} numberOfLines={1}>{item.artist}</Text>
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
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textDim} />
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
          <Ionicons name="musical-note" size={20} color={Colors.textMuted} />
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
  const gridData = filter === 'albums' ? albums : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
          style={styles.avatarBtn}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={Colors.text} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Your Library</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search')} hitSlop={12}>
            <Ionicons name="search-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={12}>
            <Ionicons name="add" size={26} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter pills */}
      <FilterPills pills={PILLS} selected={filter} onSelect={(id) => setFilter(id as FilterId)} />

      {/* Sort row */}
      <View style={styles.sortRow}>
        <TouchableOpacity style={styles.sortBtn} activeOpacity={0.7}>
          <Ionicons name="swap-vertical" size={16} color={Colors.text} />
          <Text style={styles.sortText}>Recents</Text>
        </TouchableOpacity>
        {canGrid && (
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={Colors.text}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Downloads / songs count */}
      {filter === 'downloads' && (
        <Text style={styles.countText}>
          {downloadedTracks.length} {downloadedTracks.length === 1 ? 'song' : 'songs'} downloaded
        </Text>
      )}
      {filter === 'songs' && songs.length > 0 && (
        <Text style={styles.countText}>{songs.length} songs in library</Text>
      )}

      {/* Content */}
      {showLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : filter === 'downloads' && downloadedTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="arrow-down-circle-outline" size={56} color={Colors.textDim} />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the download icon on any track to save it for offline playback
          </Text>
        </View>
      ) : viewMode === 'grid' && canGrid && gridData.length > 0 ? (
        <FlatList
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLS}
          renderItem={renderAlbumGrid}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
        />
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

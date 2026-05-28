import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlbumCard } from '../../components/AlbumCard';
import { TrackRow } from '../../components/TrackRow';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useSearch } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';

interface CategoryCard {
  id: string;
  label: string;
  color: string;
}

const CATEGORIES: CategoryCard[] = [
  { id: 'songs', label: 'Songs', color: '#7c3aed' },
  { id: 'albums', label: 'Albums', color: '#1d4ed8' },
  { id: 'artists', label: 'Artists', color: '#b45309' },
  { id: 'playlists', label: 'Playlists', color: '#15803d' },
];

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
      paddingBottom: Spacing.md,
      gap: Spacing.md,
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
      fontSize: FontSize.xxxl,
      fontWeight: '700',
    },
    searchBarWrapper: {
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.lg,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.text,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      color: Colors.background,
      fontSize: FontSize.base,
      padding: 0,
    },
    sectionTitle: {
      color: Colors.text,
      fontSize: FontSize.lg,
      fontWeight: '700',
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    categoryCard: {
      width: '48%',
      height: 110,
      borderRadius: Radius.md,
      padding: Spacing.md,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    categoryLabel: {
      color: Colors.text,
      fontSize: FontSize.lg,
      fontWeight: '700',
    },
    loader: {
      marginVertical: Spacing.xl,
    },
    horizontalList: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      gap: Spacing.md,
    },
    artistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    artistAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artistInitials: {
      color: Colors.text,
      fontSize: FontSize.base,
      fontWeight: '700',
    },
    artistInfo: {
      flex: 1,
    },
    artistName: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontWeight: '500',
    },
    artistMeta: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
    },
    emptyText: {
      color: Colors.textMuted,
      fontSize: FontSize.base,
    },
  }), [Colors]);
}

export default function SearchScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const { baseUrl } = useServer();
  const [query, setQuery] = useState('');
  const playTrack = usePlayerStore((s) => s.playTrack);

  const { data: results, isLoading } = useSearch(query);

  const showBrowse = query.length <= 1;

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header: avatar + title */}
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
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.background} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor={Colors.surfaceElevated}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.background} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Browse categories */}
      {showBrowse ? (
        <>
          <Text style={styles.sectionTitle}>Start browsing</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { backgroundColor: cat.color }]}
                onPress={() => router.push('/(tabs)/library')}
                activeOpacity={0.85}
              >
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {/* Search results */}
      {!showBrowse && isLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : null}

      {!showBrowse && results ? (
        <>
          {results.tracks.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Songs</Text>
              {results.tracks.slice(0, 5).map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  artworkUri={artworkUrl(baseUrl, track.id)}
                  onPress={() => playTrack(track, results.tracks)}
                />
              ))}
            </>
          ) : null}

          {results.albums.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Albums</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {results.albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    artworkUri={artworkUrl(baseUrl, album.id)}
                    title={album.title}
                    subtitle={album.artist}
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          {results.artists.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Artists</Text>
              {results.artists.slice(0, 5).map((artist) => (
                <TouchableOpacity
                  key={artist.id}
                  style={styles.artistRow}
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.artistAvatar}>
                    <Text style={styles.artistInitials}>
                      {artist.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.artistInfo}>
                    <Text style={styles.artistName}>{artist.name}</Text>
                    <Text style={styles.artistMeta}>Artist</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {results.tracks.length === 0 &&
            results.albums.length === 0 &&
            results.artists.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

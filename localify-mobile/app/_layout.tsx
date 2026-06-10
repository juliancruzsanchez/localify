import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { useColors } from '../constants/theme';
import { useConnectionStore } from '../store/connectionStore';
import { useDownloadStore } from '../store/downloadStore';
import { useStatsStore } from '../store/statsStore';
import { useThemeStore } from '../store/themeStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const initialized = useRef(false);
  const loadDownloads = useDownloadStore((s) => s.loadDownloads);
  const loadStats = useStatsStore((s) => s.loadStats);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Configure audio for background playback. Needs the iOS `audio`
    // UIBackgroundMode (set in app.json) to actually survive the app going
    // background; without that, iOS pauses on backgrounding regardless.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    useThemeStore.getState().loadTheme();
    loadStats();
    // Load downloads first so offline mode has content, then probe the server.
    loadDownloads().finally(() => {
      useConnectionStore
        .getState()
        .load()
        .then(() => {
          const { localUrl, publicUrl } = useConnectionStore.getState();
          const hasServer = !!(localUrl || publicUrl);
          const inTabs = segments[0] === '(tabs)';
          // Enter the app whenever a server is configured — even if it's
          // currently unreachable (offline mode). Only the first-run case
          // with no saved address goes to the connect screen.
          if (!hasServer && !inTabs) {
            router.replace('/connect');
          } else if (hasServer) {
            router.replace('/(tabs)');
          }
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

// Floating mini-player for full-screen pushed routes (album, artist, playlist,
// stats). Tab screens render their own copy above the tab bar, and the
// now-playing modal / connect screen shouldn't show it.
function FloatingNowPlayingBar() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const Colors = useColors();
  const top = segments[0];
  if (top === undefined || top === '(tabs)' || top === 'now-playing' || top === 'connect') {
    return null;
  }
  // Pin flush to the bottom edge and pad for the home indicator so the bar's
  // background extends all the way down rather than floating with a gap.
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom,
        backgroundColor: Colors.surfaceElevated,
      }}
    >
      <NowPlayingBar />
    </View>
  );
}

function ThemedStack() {
  const Colors = useColors();
  return (
    <View style={{ flex: 1 }}>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
        // iOS otherwise labels the back button with the previous route's
        // title, which is the "(tabs)" group name. Show just the chevron.
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="connect" options={{ headerShown: false }} />
      <Stack.Screen
        name="album/[id]"
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="artist/[id]"
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="now-playing"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="stats"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
    </Stack>
      <FloatingNowPlayingBar />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <NavigationGuard>
        <ThemedStack />
      </NavigationGuard>
    </QueryClientProvider>
  );
}

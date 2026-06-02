import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
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

function ThemedStack() {
  const Colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
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

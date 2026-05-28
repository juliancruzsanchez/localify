import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Colors } from '../constants/theme';
import { loadServerUrl } from '../hooks/useServer';
import { useDownloadStore } from '../store/downloadStore';
import { usePlayerStore } from '../store/playerStore';
import { useStatsStore } from '../store/statsStore';

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
  const setBaseUrl = usePlayerStore((s) => s.setBaseUrl);
  const loadDownloads = useDownloadStore((s) => s.loadDownloads);
  const loadStats = useStatsStore((s) => s.loadStats);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    loadDownloads();
    loadStats();
    loadServerUrl().then((url) => {
      setBaseUrl(url);
      const inTabs = segments[0] === '(tabs)';
      if (!url && !inTabs) {
        router.replace('/connect');
      } else if (url) {
        router.replace('/(tabs)');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <NavigationGuard>
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
      </NavigationGuard>
    </QueryClientProvider>
  );
}

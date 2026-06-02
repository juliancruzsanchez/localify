import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { NowPlayingBar } from '../../components/NowPlayingBar';
import { useColors, FontSize } from '../../constants/theme';

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    tabBarWrapper: {
      backgroundColor: Colors.tabBar,
    },
    tabBar: {
      backgroundColor: Colors.tabBar,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      paddingBottom: 20,
      paddingTop: 8,
      height: 64,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    tabLabel: {
      fontSize: FontSize.xs,
      fontWeight: '600',
      textAlign: 'center',
    },
  }), [Colors]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabBar({ state, descriptors, navigation }: any) {
  const styles = useStyles();
  const Colors = useColors();

  return (
    <View style={styles.tabBarWrapper}>
      <NowPlayingBar />
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const descriptor = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            typeof descriptor.options.tabBarLabel === 'string'
              ? descriptor.options.tabBarLabel
              : descriptor.options.title ?? route.name;

          const iconFn = descriptor.options.tabBarIcon;
          const icon = iconFn
            ? iconFn({ focused: isFocused, color: isFocused ? Colors.text : Colors.textDim, size: 24 })
            : null;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              activeOpacity={0.7}
            >
              {icon}
              <Text style={[styles.tabLabel, { color: isFocused ? Colors.text : Colors.textDim }]}>
                {label === 'index' ? 'Home' : label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const Colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ConnectionBanner />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Your Library',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}

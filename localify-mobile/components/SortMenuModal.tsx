import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';
import type { SortPref } from '../hooks/useSortPref';

export interface SortOption<K extends string> {
  key:   K;
  label: string;
}

interface Props<K extends string> {
  visible:  boolean;
  options:  SortOption<K>[];
  pref:     SortPref<K>;
  onToggle: (key: K) => void;
  onClose:  () => void;
}

export function SortMenuModal<K extends string>({
  visible, options, pref, onToggle, onClose,
}: Props<K>) {
  const Colors = useColors();
  const styles = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xl,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.textDim,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      color: Colors.textMuted,
      fontSize: FontSize.xs,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
    },
    label: {
      fontSize: FontSize.md,
      fontWeight: '500',
    },
    rightGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
  }), [Colors]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.header}>Sort by</Text>
          {options.map((opt) => {
            const isActive = pref.key === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.row}
                onPress={() => { onToggle(opt.key); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.label, { color: isActive ? Colors.text : Colors.textMuted }]}>
                  {opt.label}
                </Text>
                {isActive && (
                  <View style={styles.rightGroup}>
                    <Ionicons
                      name={pref.dir === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={Colors.accent}
                    />
                    <Ionicons name="checkmark" size={16} color={Colors.accent} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';

export interface Pill {
  id: string;
  label: string;
}

interface Props {
  pills: Pill[];
  selected: string;
  onSelect: (id: string) => void;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
      flexDirection: 'row',
    },
    pill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.full,
    },
    pillActive: {
      backgroundColor: Colors.accent,
    },
    pillInactive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.textDim,
    },
    label: {
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    labelActive: {
      color: Colors.background,
    },
    labelInactive: {
      color: Colors.text,
    },
  }), [Colors]);
}

export function FilterPills({ pills, selected, onSelect }: Props) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {pills.map((pill) => {
        const isActive = pill.id === selected;
        return (
          <TouchableOpacity
            key={pill.id}
            style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            onPress={() => onSelect(pill.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
              {pill.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

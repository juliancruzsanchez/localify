import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, FontSize, Spacing } from '../constants/theme';

interface Props {
  title: string;
  rightLabel?: string;
  onRightPress?: () => void;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    title: {
      color: Colors.text,
      fontSize: FontSize.lg,
      fontWeight: '700',
    },
    right: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
  }), [Colors]);
}

export function SectionHeader({ title, rightLabel, onRightPress }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {rightLabel ? (
        <Text style={styles.right} onPress={onRightPress}>
          {rightLabel}
        </Text>
      ) : null}
    </View>
  );
}

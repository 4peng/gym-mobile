import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE } from "@/constants/theme";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}

/** Centred placeholder for empty lists. */
export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Text style={[TYPE.heading, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[TYPE.bodyMuted, styles.subtitle]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: SPACE.xxxl * 2,
    paddingHorizontal: SPACE.xxxl,
    gap: SPACE.sm,
  },
  title: { marginTop: SPACE.md, textAlign: "center" },
  subtitle: { textAlign: "center" },
});

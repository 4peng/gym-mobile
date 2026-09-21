import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MoreHorizontal, Pin, Play } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";
import { Swipeable } from "@/components/Swipeable";
import { IconButton } from "@/components/ui/IconButton";
import type { Program } from "@/types";

interface ProgramTileProps {
  program: Program;
  lastUsedAt?: number;
  onPress: (id: string) => void;
  onStart: (program: Program) => void;
  onDelete: (id: string, name: string) => void;
  onPin: (id: string) => void;
  onToggleScroll: (enabled: boolean) => void;
}

export const formatLastUsed = (lastUsedAt?: number) =>
  lastUsedAt
    ? new Date(lastUsedAt)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" })
        .toUpperCase()
    : "NEVER";

/** Saved routine card: swipe left to delete, right to pin. */
export const ProgramTile = React.memo<ProgramTileProps>(function ProgramTile({
  program,
  lastUsedAt,
  onPress,
  onStart,
  onDelete,
  onPin,
  onToggleScroll,
}) {
  const title = program.name || "Untitled Routine";
  const count = program.exercises?.length ?? 0;

  return (
    <Swipeable
      onDelete={() => onDelete(program._id, title)}
      onPin={() => onPin(program._id)}
      onToggleScroll={onToggleScroll}
      borderRadius={RADIUS.container}
      marginBottom={SPACE.md}
    >
      <Pressable
        onPress={() => onPress(program._id)}
        style={({ pressed }) => [UI.card, styles.card, pressed && UI.pressed]}
      >
        <View style={UI.rowBetween}>
          <View style={[UI.row, { gap: SPACE.sm - 2 }]}>
            <Text style={[TYPE.label, program.pinned && { color: COLORS.ACCENT_BLUE }]}>
              {program.pinned ? "Pinned" : "Routine"}
            </Text>
            <Text style={[TYPE.label, { color: COLORS.TEXT_TERTIARY }]}>/</Text>
            <Text style={TYPE.label}>{String(count).padStart(2, "0")} ex</Text>
          </View>
          {program.pinned ? (
            <Pin size={14} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.meta}>
          <View style={[UI.inset, styles.metaCell]}>
            <Text style={TYPE.label}>Loadout</Text>
            <Text style={[TYPE.monoSmall, styles.metaValue]}>
              {count} exercise{count === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={[UI.inset, styles.metaCell]}>
            <Text style={TYPE.label}>Last run</Text>
            <Text style={[TYPE.monoSmall, styles.metaValue]}>{formatLastUsed(lastUsedAt)}</Text>
          </View>
        </View>

        <View style={UI.rowBetween}>
          <Text style={TYPE.caption}>Tap card to edit</Text>
          <View style={[UI.row, { gap: SPACE.sm + 2 }]}>
            <IconButton size="md" onPress={() => onPress(program._id)}>
              <MoreHorizontal size={18} color={COLORS.TEXT_SECONDARY} />
            </IconButton>
            <IconButton size="md" tone="primary" onPress={() => onStart(program)}>
              <Play size={16} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
            </IconButton>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, gap: SPACE.md },
  name: { ...TYPE.titleSm, lineHeight: 24 },
  meta: { flexDirection: "row", gap: SPACE.md },
  metaCell: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    justifyContent: "center",
    gap: SPACE.xs,
  },
  metaValue: { color: COLORS.TEXT_PRIMARY },
});

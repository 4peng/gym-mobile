import React, { useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MoreHorizontal, Pin, Play } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { Swipeable } from "@/components/Swipeable";
import type { Program } from "@/types";

interface ProgramTileProps {
  program: Program;
  lastUsedAt?: number;
  onPress: (id: string) => void;
  onStart: (program: Program) => void;
  onDelete: (id: string, name: string) => void;
  onPin: (id: string) => void;
  onOptions: (program: Program) => void;
  onToggleScroll: (enabled: boolean) => void;
}

const formatLastUsed = (lastUsedAt?: number) => {
  if (!lastUsedAt) return "NEVER";

  return new Date(lastUsedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }).toUpperCase();
};

export const ProgramTile = React.memo<ProgramTileProps>(function ProgramTile({
  program,
  lastUsedAt,
  onPress,
  onStart,
  onDelete,
  onPin,
  onOptions,
  onToggleScroll,
}) {
  const handlePress = useCallback(() => onPress(program._id), [onPress, program._id]);
  const handleStart = useCallback(() => onStart(program), [onStart, program]);
  const handlePin = useCallback(() => onPin(program._id), [onPin, program._id]);
  const handleOptions = useCallback(() => onOptions(program), [onOptions, program]);

  const exerciseCount = program.exercises?.length || 0;
  const title = typeof program.name === "string"
    ? program.name
    : (program.name as { name?: string } | undefined)?.name || "Untitled Routine";

  const lastUsedLabel = useMemo(() => formatLastUsed(lastUsedAt), [lastUsedAt]);

  return (
    <Swipeable
      onDelete={() => onDelete(program._id, title)}
      onPin={handlePin}
      onToggleScroll={onToggleScroll}
      borderRadius={UI.RADIUS_CONTAINER}
      marginBottom={12}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.topRow}>
          <View style={styles.tagRow}>
            <Text style={[styles.tag, program.pinned && styles.tagPinned]}>
              {program.pinned ? "PINNED" : "ROUTINE"}
            </Text>
            <Text style={styles.tagDivider}>/</Text>
            <Text style={styles.tag}>{exerciseCount.toString().padStart(2, "0")} EX</Text>
          </View>

          {program.pinned ? <Pin size={14} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} /> : null}
        </View>

        <Text style={styles.programName} numberOfLines={2}>{title}</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>LOADOUT</Text>
            <Text style={styles.metaValue}>
              {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>LAST RUN</Text>
            <Text style={styles.metaValue}>{lastUsedLabel}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerHint}>Tap card to edit</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={handleOptions}
              hitSlop={10}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.ghostPressed]}
            >
              <MoreHorizontal size={18} color={COLORS.TEXT_SECONDARY} />
            </Pressable>

            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [styles.startBtn, pressed && styles.ghostPressed]}
            >
              <Play size={16} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    backgroundColor: COLORS.CARD_BG,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tagPinned: {
    color: COLORS.ACCENT_BLUE,
  },
  tagDivider: {
    color: COLORS.BORDER_LIGHT,
    fontSize: 10,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
  programName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    lineHeight: 26,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  metaCell: {
    flex: 1,
    minHeight: 54,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.BG,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  metaLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerHint: {
    flex: 1,
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MONO,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  startBtn: {
    width: 40,
    height: 40,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  ghostPressed: {
    opacity: 0.84,
  },
});

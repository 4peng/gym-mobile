import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Play, Activity, Pin, MoreHorizontal } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { Swipeable } from "@/components/Swipeable";
import type { Program } from "@/types";

interface ProgramTileProps {
  program: Program;
  onPress: (id: string) => void;
  onStart: (program: Program) => void;
  onDelete: (id: string, name: string) => void;
  onPin: (id: string) => void;
  onOptions: (program: Program) => void;
  onToggleScroll: (enabled: boolean) => void;
}

export const ProgramTile = React.memo<ProgramTileProps>(function ProgramTile({
  program,
  onPress,
  onStart,
  onDelete,
  onPin,
  onOptions,
  onToggleScroll,
}) {
  const handlePress = useCallback(() => onPress(program._id), [program._id, onPress]);
  const handleStart = useCallback(() => onStart(program), [program, onStart]);
  const handlePin = useCallback(() => onPin(program._id), [program._id, onPin]);
  const handleOptions = useCallback(() => onOptions(program), [program, onOptions]);

  return (
    <Swipeable 
      onDelete={() => onDelete(program._id, program.name)} 
      onPin={handlePin}
      onToggleScroll={onToggleScroll}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          UI.SHARED.card,
          { padding: 24, marginBottom: 0, borderRadius: 0 },
          pressed && styles.tilePressed
        ]}
      >
        <View style={styles.tileHeader}>
          <View style={styles.tileMainInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.programName} numberOfLines={1}>
                {typeof program.name === "string" ? program.name : (program.name as any)?.name || "Untitled Routine"}
              </Text>
              {program.pinned && (
                <Pin size={16} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
              )}
            </View>
            <View style={styles.metaRow}>
              <Activity size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.metaText}>
                {(program.exercises?.length || 0)} {(program.exercises?.length === 1) ? "Exercise" : "Exercises"}
              </Text>
            </View>
          </View>
          
          <View style={styles.tileActions}>
            <Pressable
              onPress={handleOptions}
              hitSlop={10}
              style={({ pressed }) => [
                styles.tileIconBtn,
                pressed && styles.tileIconBtnPressed,
              ]}
            >
              <MoreHorizontal size={18} color={COLORS.TEXT_SECONDARY} />
            </Pressable>

            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [
                styles.tileStartBtn,
                pressed && styles.tileStartBtnPressed
              ]}
            >
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  tilePressed: {
    backgroundColor: COLORS.CARD_HOVER,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileMainInfo: {
    flex: 1,
    marginRight: 16,
    minWidth: 0,
  },
  programName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  tileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.CARD_HOVER,
    justifyContent: "center",
    alignItems: "center",
  },
  tileIconBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  tileStartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.ACCENT_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tileStartBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
});

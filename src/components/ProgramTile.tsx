import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Play, ChevronRight, Activity, Pin } from "lucide-react-native";
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
  onToggleScroll: (enabled: boolean) => void;
}

export const ProgramTile = React.memo<ProgramTileProps>(function ProgramTile({
  program,
  onPress,
  onStart,
  onDelete,
  onPin,
  onToggleScroll,
}) {
  const handlePress = useCallback(() => onPress(program._id), [program._id, onPress]);
  const handleStart = useCallback(() => onStart(program), [program, onStart]);
  const handlePin = useCallback(() => onPin(program._id), [program._id, onPin]);

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
          <ChevronRight size={20} color={COLORS.BORDER_LIGHT} />
        </View>

        <View style={styles.tileActions}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.tileStartBtn,
              pressed && styles.tileStartBtnPressed
            ]}
          >
            <Play size={16} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
            <Text style={styles.tileStartText}>Start Session</Text>
          </Pressable>
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
    marginBottom: 20,
  },
  tileMainInfo: {
    flex: 1,
  },
  programName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 6,
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
    gap: 12,
  },
  tileStartBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#1D1D21",
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  tileStartBtnPressed: {
    backgroundColor: "#27272A",
  },
  tileStartText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 14,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});

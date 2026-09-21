import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronRight, Search, X, Zap } from "lucide-react-native";
import { COLORS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { formatLastUsed } from "@/components/ProgramTile";
import type { Program } from "@/types";

interface StartWorkoutSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Routines in display order (pinned first, most recently used next). */
  programs: Program[];
  lastUsed: Map<string, number>;
  onStartBlank: () => void;
  onStartProgram: (program: Program) => void;
}

/** "Start" picker: search the routines, or begin a blank workout right away. */
export default function StartWorkoutSheet({
  visible,
  onClose,
  programs,
  lastUsed,
  onStartBlank,
  onStartProgram,
}: StartWorkoutSheetProps) {
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? programs.filter((p) => p.name.toLowerCase().includes(q)) : programs;
  }, [programs, search]);

  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dragToClose
      title="Start workout"
      headerRight={
        <IconButton size="md" ghost onPress={onClose}>
          <X size={20} color={COLORS.TEXT_TERTIARY} />
        </IconButton>
      }
    >
      <View style={[UI.inset, styles.search]}>
        <Search size={16} color={COLORS.TEXT_TERTIARY} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search routines..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Pressable
            onPress={pick(onStartBlank)}
            style={({ pressed }) => [UI.inset, styles.row, styles.blank, pressed && UI.pressed]}
          >
            <Zap size={18} color={COLORS.ACCENT_GREEN} fill={COLORS.ACCENT_GREEN} />
            <View style={{ flex: 1 }}>
              <Text style={TYPE.body}>Blank workout</Text>
              <Text style={TYPE.caption}>Add exercises as you go</Text>
            </View>
            <ChevronRight size={16} color={COLORS.ACCENT_GREEN} />
          </Pressable>
        }
        renderItem={({ item }) => {
          const count = item.exercises.length;
          return (
            <Pressable
              onPress={pick(() => onStartProgram(item))}
              style={({ pressed }) => [UI.inset, styles.row, pressed && UI.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={TYPE.body}>{item.name || "Untitled Routine"}</Text>
                <Text style={TYPE.caption}>
                  {count} exercise{count === 1 ? "" : "s"} · Last run{" "}
                  {formatLastUsed(lastUsed.get(item._id)).toLowerCase()}
                </Text>
              </View>
              <ChevronRight size={16} color={COLORS.TEXT_TERTIARY} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={[TYPE.bodyMuted, styles.empty]}>
            {search ? "No routines match." : "No routines yet."}
          </Text>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACE.xl,
    marginVertical: SPACE.lg,
    paddingHorizontal: SPACE.lg,
  },
  searchInput: { ...TYPE.body, flex: 1, paddingVertical: SPACE.md + 2, marginLeft: SPACE.sm + 2 },
  list: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.lg },
  blank: { backgroundColor: SURFACE.greenTint, borderColor: SURFACE.greenBorder },
  empty: { textAlign: "center", paddingVertical: SPACE.xxxl },
});

import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Search } from "lucide-react-native";
import { EXERCISE_CATALOG } from "@/data/exerciseCatalog";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import type { ExerciseDefinition } from "@/types";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";
import { MUSCLE_LABELS, type MuscleGroup } from "@/constants/muscles";

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDefinition) => void;
  selectedDefinitionId?: string;
  title?: string;
  subtitle?: string;
}

function matchesSearch(exercise: ExerciseDefinition, query: string) {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return true;

  if (exercise.name.toLowerCase().includes(lowerQuery)) {
    return true;
  }

  return (exercise.aliases || []).some((alias) => alias.toLowerCase().includes(lowerQuery));
}

export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  selectedDefinitionId,
  title = "Select Exercise",
  subtitle = "Search the library or add a custom exercise.",
}: ExercisePickerModalProps) {
  const [search, setSearch] = useState("");
  const customExercises = useExerciseLibraryStore((state) => state.customExercises);
  const addCustomExercise = useExerciseLibraryStore((state) => state.addCustomExercise);

  useEffect(() => {
    if (!visible) {
      setSearch("");
    }
  }, [visible]);

  const allExercises = useMemo(
    () => [...customExercises, ...EXERCISE_CATALOG],
    [customExercises]
  );

  const filteredExercises = useMemo(
    () => allExercises.filter((exercise) => matchesSearch(exercise, search)),
    [allExercises, search]
  );

  const canAddCustomExercise =
    search.trim().length > 0 &&
    filteredExercises.length === 0;

  const handleSelect = (exercise: ExerciseDefinition) => {
    onSelect(exercise);
    onClose();
  };

  const handleAddCustomExercise = () => {
    const next = addCustomExercise(search.trim());
    handleSelect(next);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Check size={22} color={COLORS.ACCENT_GREEN} />
            </Pressable>
          </View>

          <View style={styles.searchShell}>
            <Search size={16} color={COLORS.TEXT_TERTIARY} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises..."
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              autoFocus
            />
          </View>

          {canAddCustomExercise ? (
            <Pressable
              style={({ pressed }) => [
                styles.customAddBtn,
                pressed && styles.customAddBtnPressed,
              ]}
              onPress={handleAddCustomExercise}
            >
              <Text style={styles.customAddLabel}>Add Custom Exercise</Text>
              <Text style={styles.customAddValue}>{search.trim()}</Text>
            </Pressable>
          ) : null}

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.id === selectedDefinitionId;

              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.item,
                    isSelected && styles.itemSelected,
                  ]}
                >
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSubtitle}>
                      {(item.muscles || []).length > 0
                        ? item.muscles
                            .map((muscle) => MUSCLE_LABELS[muscle as MuscleGroup] || muscle)
                            .join(" • ")
                        : item.isCustom
                          ? "Custom exercise"
                          : "Uncategorized"}
                    </Text>
                  </View>
                  {isSelected ? <Check size={18} color={COLORS.ACCENT_BLUE} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              !canAddCustomExercise ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No exercises found.</Text>
                </View>
              ) : null
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "84%",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  subtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    marginTop: 4,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  searchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    paddingVertical: 14,
    marginLeft: 10,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  customAddBtn: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: "rgba(11, 130, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
    borderRadius: 18,
    padding: 16,
  },
  customAddBtnPressed: {
    backgroundColor: "rgba(11, 130, 255, 0.12)",
  },
  customAddLabel: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  customAddValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    padding: 16,
  },
  itemSelected: {
    borderColor: "rgba(11, 130, 255, 0.25)",
    backgroundColor: "rgba(11, 130, 255, 0.08)",
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  itemSubtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    marginTop: 4,
    textTransform: "capitalize",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});

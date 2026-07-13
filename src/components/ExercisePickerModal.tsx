import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { Check, Pencil, Search, X } from "lucide-react-native";
import { EXERCISE_CATALOG } from "@/data/exerciseCatalog";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import type { ExerciseDefinition } from "@/types";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";
import { MUSCLE_LABELS, type MuscleGroup } from "@/constants/muscles";
import {
  matchesExerciseSearchQuery,
  normalizeExerciseDisplayName,
  normalizeExerciseIdentityKey,
} from "@/utils/exerciseIdentity";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { showAlert } from "@/utils/alerts";
import { Swipeable } from "./Swipeable";

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDefinition) => void;
  selectedDefinitionId?: string;
  title?: string;
  subtitle?: string;
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
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [renameTarget, setRenameTarget] = useState<ExerciseDefinition | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<TextInput>(null);
  const animValue = useRef(new Animated.Value(0)).current;
const dragOffset = useRef(new Animated.Value(0)).current;
  const [renderVisible, setRenderVisible] = useState(visible);
  const renameAnimValue = useRef(new Animated.Value(0)).current;
  const [renderRenameVisible, setRenderRenameVisible] = useState(false);

  const customExercises = useExerciseLibraryStore((state) => state.customExercises);
  const addCustomExercise = useExerciseLibraryStore((state) => state.addCustomExercise);
  const renameCustomExercise = useExerciseLibraryStore((state) => state.renameCustomExercise);
  const removeCustomExercise = useExerciseLibraryStore((state) => state.removeCustomExercise);
  const renameExerciseDefinitionReferencesInPrograms = useProgramStore(
    (state) => state.renameExerciseDefinitionReferences
  );
  const removeExerciseDefinitionReferencesInPrograms = useProgramStore(
    (state) => state.removeExerciseDefinitionReferences
  );
  const renameExerciseDefinitionReferencesInWorkouts = useWorkoutSessionStore(
    (state) => state.renameExerciseDefinitionReferences
  );
  const removeExerciseDefinitionReferencesInHistory = useWorkoutSessionStore(
    (state) => state.removeExerciseDefinitionReferences
  );

  const handleDeleteCustomExercise = (id: string) => {
    // 1. Orphanize references in programs and history
    removeExerciseDefinitionReferencesInPrograms(id);
    removeExerciseDefinitionReferencesInHistory(id);

    // 2. Remove the custom definition
    removeCustomExercise(id);
  };

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setRenameTarget(null);
      setRenameDraft("");
    }
  }, [visible]);

  useEffect(() => {
    if (!renameTarget) return;

    const timeout = setTimeout(() => {
      renameInputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timeout);
  }, [renameTarget?.id]);

  useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.timing(animValue, { 
        toValue: 1, 
        duration: 180, 
        easing: Easing.out(Easing.quad),
        useNativeDriver: true 
      }).start();
    } else {
      Animated.timing(animValue, { 
        toValue: 0, 
        duration: 180, 
        easing: Easing.in(Easing.quad),
        useNativeDriver: true 
      }).start(() => setRenderVisible(false));
    }
  }, [visible]);

  useEffect(() => {
    if (renameTarget) {
      setRenderRenameVisible(true);
      Animated.timing(renameAnimValue, { 
        toValue: 1, 
        duration: 180, 
        useNativeDriver: true 
      }).start();
    } else {
      Animated.timing(renameAnimValue, { 
        toValue: 0, 
        duration: 180, 
        useNativeDriver: true 
      }).start(() => setRenderRenameVisible(false));
    }
  }, [renameTarget]);

  // Drag-to-close functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragOffset.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          onClose();
        }
        Animated.spring(dragOffset, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const allExercises = useMemo(
    () => [...customExercises, ...EXERCISE_CATALOG],
    [customExercises]
  );

  const filteredExercises = useMemo(
    () => allExercises.filter((exercise) => matchesExerciseSearchQuery(exercise, search)),
    [allExercises, search]
  );

  const normalizedSearch = normalizeExerciseDisplayName(search);
  const normalizedSearchIdentityKey = normalizeExerciseIdentityKey(normalizedSearch);
  const normalizedRenameDraft = normalizeExerciseDisplayName(renameDraft);
  const normalizedRenameDraftIdentityKey = normalizeExerciseIdentityKey(normalizedRenameDraft);

  const conflictingSearchCatalogExercise = useMemo(
    () =>
      normalizedSearchIdentityKey
        ? EXERCISE_CATALOG.find((exercise) => exercise.id === normalizedSearchIdentityKey)
        : undefined,
    [normalizedSearchIdentityKey]
  );

  const conflictingRenameCatalogExercise = useMemo(
    () =>
      normalizedRenameDraftIdentityKey
        ? EXERCISE_CATALOG.find((exercise) => exercise.id === normalizedRenameDraftIdentityKey)
        : undefined,
    [normalizedRenameDraftIdentityKey]
  );

  const conflictingRenameCustomExercise = useMemo(
    () =>
      normalizedRenameDraft.length > 0
        ? customExercises.find(
            (exercise) =>
              exercise.id !== renameTarget?.id &&
              (exercise.name.trim().toLowerCase() === normalizedRenameDraft.toLowerCase() ||
                (exercise.aliases || []).some(
                  (alias) => alias.trim().toLowerCase() === normalizedRenameDraft.toLowerCase()
                ))
          )
        : undefined,
    [customExercises, normalizedRenameDraft, renameTarget?.id]
  );

  const canAddCustomExercise =
    normalizedSearch.length > 0 &&
    filteredExercises.length === 0 &&
    !conflictingSearchCatalogExercise;

  const canRenameCustomExercise =
    !!renameTarget &&
    normalizedRenameDraft.length > 0 &&
    normalizedRenameDraft.toLowerCase() !== renameTarget.name.toLowerCase() &&
    !conflictingRenameCatalogExercise &&
    !conflictingRenameCustomExercise;

  const renameValidationMessage = renameTarget
    ? normalizedRenameDraft.length === 0
      ? "Enter a name for this custom exercise."
      : normalizedRenameDraft.toLowerCase() === renameTarget.name.toLowerCase()
        ? "Enter a different name to rename this custom exercise."
        : conflictingRenameCatalogExercise
          ? `Built-in exercise already exists: ${conflictingRenameCatalogExercise.name}.`
          : conflictingRenameCustomExercise
            ? `Custom exercise already exists: ${conflictingRenameCustomExercise.name}.`
            : null
    : null;

  const handleSelect = (exercise: ExerciseDefinition) => {
    onSelect(exercise);
    onClose();
  };

  const handleAddCustomExercise = () => {
    const next = addCustomExercise(normalizedSearch);
    handleSelect(next);
  };

  const startRenameCustomExercise = (exercise: ExerciseDefinition) => {
    setRenameTarget(exercise);
    setRenameDraft(exercise.name);
  };

  const cancelRenameCustomExercise = () => {
    setRenameTarget(null);
    setRenameDraft("");
  };

  const handleRenameCustomExercise = () => {
    if (!renameTarget) return;

    if (conflictingRenameCatalogExercise) {
      showAlert(
        "Built-In Exercise Exists",
        `Use ${conflictingRenameCatalogExercise.name} from the library instead of renaming this custom exercise to match it.`
      );
      return;
    }

    if (conflictingRenameCustomExercise) {
      showAlert(
        "Custom Exercise Exists",
        `A custom exercise named ${conflictingRenameCustomExercise.name} already exists.`
      );
      return;
    }

    const renamed = renameCustomExercise(renameTarget.id, normalizedRenameDraft);
    if (!renamed) {
      showAlert("Rename Failed", "Pick a different name for this custom exercise.");
      return;
    }

    renameExerciseDefinitionReferencesInPrograms(renamed.id, renamed.name);
    renameExerciseDefinitionReferencesInWorkouts(renamed.id, renamed.name);

    const shouldReselect = renamed.id === selectedDefinitionId;
    setRenameTarget(null);
    setRenameDraft("");

    if (shouldReselect) {
      onSelect(renamed);
    }
  };

  if (!renderVisible) return null;

  return (
    <View style={styles.absoluteOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: animValue }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              {
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0]
                })
              },
              { translateY: dragOffset }
            ]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={COLORS.TEXT_TERTIARY} />
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
            <Text style={styles.customAddValue}>{normalizedSearch}</Text>
          </Pressable>
        ) : null}

        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedDefinitionId;
            const subtitleText =
              (item.muscles || []).length > 0
                ? item.muscles
                    .map((muscle) => MUSCLE_LABELS[muscle as MuscleGroup] || muscle)
                    .join(" - ")
                : item.isCustom
                  ? "Custom exercise"
                  : "Uncategorized";

            const content = (
              <View
                style={[
                  styles.item,
                  item.isCustom && styles.itemCustom,
                  isSelected && styles.itemSelected,
                ]}
              >
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={styles.itemMain}
                >
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSubtitle}>{subtitleText}</Text>
                  </View>
                  {isSelected ? <Check size={18} color={COLORS.ACCENT_BLUE} /> : null}
                </Pressable>

                {item.isCustom ? (
                  <Pressable
                    onPress={() => startRenameCustomExercise(item)}
                    hitSlop={16}
                    style={({ pressed }) => [
                      styles.customBadge,
                      pressed && { opacity: 0.7, backgroundColor: "rgba(16, 217, 75, 0.15)" },
                    ]}
                  >
                    <Pencil size={14} color={COLORS.ACCENT_GREEN} />
                  </Pressable>
                ) : null}
              </View>
            );

            if (item.isCustom) {
              return (
                <View style={styles.swipeWrapper}>
                  <Swipeable
                    onDelete={() => handleDeleteCustomExercise(item.id)}
                    onToggleScroll={setScrollEnabled}
                    borderRadius={UI.RADIUS_INPUT}
                    marginBottom={0}
                  >
                    {content}
                  </Swipeable>
                </View>
              );
            }

            return (
              <View style={{ marginHorizontal: 16 }}>
                {content}
              </View>
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

        {/* Rename Modal */}
        {renderRenameVisible ? (
          <Animated.View style={[styles.renameOverlay, { opacity: renameAnimValue }]}>
            <KeyboardAvoidingView
              style={styles.renameSheetWrapper}
              behavior="padding"
              keyboardVerticalOffset={0}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={cancelRenameCustomExercise} />
              
              <Animated.View style={[styles.renameSheet, {
                transform: [{
                  scale: renameAnimValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1]
                  })
                }]
              }]}>
                <Text style={styles.customRenameLabel}>Rename Custom Exercise</Text>
                <Text style={styles.renameSheetTitle}>{renameTarget?.name}</Text>
                <TextInput
                  ref={renameInputRef}
                  style={styles.customRenameInput}
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  placeholder="Exercise name"
                  placeholderTextColor={COLORS.TEXT_TERTIARY}
                  returnKeyType="done"
                  onSubmitEditing={handleRenameCustomExercise}
                />
                {renameValidationMessage ? (
                  <Text style={styles.customRenameHint}>{renameValidationMessage}</Text>
                ) : null}

                <View style={styles.customRenameActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.renameSecondaryBtn,
                      pressed && styles.renameSecondaryBtnPressed,
                    ]}
                    onPress={cancelRenameCustomExercise}
                  >
                    <X size={14} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.renameSecondaryText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.renamePrimaryBtn,
                      !canRenameCustomExercise && styles.renamePrimaryBtnDisabled,
                      pressed && canRenameCustomExercise && styles.renamePrimaryBtnPressed,
                    ]}
                    onPress={handleRenameCustomExercise}
                    disabled={!canRenameCustomExercise}
                  >
                    <Pencil size={14} color={COLORS.TEXT_PRIMARY} />
                    <Text style={styles.renamePrimaryText}>Save Name</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  renameSheetWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 10001,
  },
  container: {
    flex: 1,
    maxHeight: '80%',
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: UI.RADIUS_HUD,
    borderTopRightRadius: UI.RADIUS_HUD,
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
    borderRadius: UI.RADIUS_ITEM,
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
    borderRadius: UI.RADIUS_CONTAINER,
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
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(11, 130, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
    borderRadius: UI.RADIUS_INPUT,
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
    paddingHorizontal: 0,
    gap: 8,
  },
  swipeWrapper: {
    marginHorizontal: 16,
    borderRadius: UI.RADIUS_INPUT,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    marginBottom: 0, // Handled by gap or marginHorizontal wrapper
  },
  itemCustom: {
    backgroundColor: COLORS.CARD_BG, // Solid opaque background for swiping, slightly darker than standard
  },
  itemSelected: {
    borderColor: "rgba(11, 130, 255, 0.25)",
    backgroundColor: "rgba(11, 130, 255, 0.12)", // Selection color
  },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
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
  customBadge: {
    width: 32,
    height: 32,
    borderRadius: UI.RADIUS_ITEM,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 217, 75, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 217, 75, 0.25)",
    marginRight: 12,
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
  renameOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10001,
  },
  renameSheet: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_HUD,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  customRenameLabel: {
    color: COLORS.ACCENT_GREEN,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  renameSheetTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  customRenameInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: FONT_FAMILIES.MEDIUM,
    backgroundColor: COLORS.BG,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  customRenameHint: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 8,
  },
  customRenameActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  renameSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: UI.RADIUS_ITEM,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  renameSecondaryBtnPressed: {
    opacity: 0.82,
  },
  renameSecondaryText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  renamePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: UI.RADIUS_ITEM,
    backgroundColor: COLORS.ACCENT_GREEN,
  },
  renamePrimaryBtnPressed: {
    opacity: 0.9,
  },
  renamePrimaryBtnDisabled: {
    opacity: 0.45,
  },
  renamePrimaryText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Pencil, Search, X } from "lucide-react-native";
import { EXERCISE_CATALOG } from "@/data/exerciseCatalog";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import type { ExerciseDefinition } from "@/types";
import {
  matchesCustomExerciseNameOrAlias,
  useExerciseLibraryStore,
} from "@/stores/exerciseLibraryStore";
import { formatMuscleLabels } from "@/constants/muscles";
import {
  matchesExerciseSearchQuery,
  normalizeExerciseDisplayName,
  normalizeExerciseIdentityKey,
} from "@/utils/exerciseIdentity";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { showAlert } from "@/utils/alerts";
import { Swipeable } from "./Swipeable";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDefinition) => void;
  selectedDefinitionId?: string;
  title?: string;
}

/** Search the catalog or custom exercises; create, rename and delete custom ones. */
export default function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  selectedDefinitionId,
  title = "Select exercise",
}: ExercisePickerModalProps) {
  const [search, setSearch] = useState("");
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [renameTarget, setRenameTarget] = useState<ExerciseDefinition | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<TextInput>(null);

  const customExercises = useExerciseLibraryStore((s) => s.customExercises);
  const addCustomExercise = useExerciseLibraryStore((s) => s.addCustomExercise);
  const renameCustomExercise = useExerciseLibraryStore((s) => s.renameCustomExercise);
  const removeCustomExercise = useExerciseLibraryStore((s) => s.removeCustomExercise);
  const renameInPrograms = useProgramStore((s) => s.renameExerciseDefinitionReferences);
  const removeInPrograms = useProgramStore((s) => s.removeExerciseDefinitionReferences);
  const renameInWorkouts = useWorkoutSessionStore((s) => s.renameExerciseDefinitionReferences);
  const removeInWorkouts = useWorkoutSessionStore((s) => s.removeExerciseDefinitionReferences);

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setRenameTarget(null);
      setRenameDraft("");
    }
  }, [visible]);

  useEffect(() => {
    if (!renameTarget) return;
    const t = setTimeout(() => renameInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [renameTarget]);

  const allExercises = useMemo(() => [...customExercises, ...EXERCISE_CATALOG], [customExercises]);
  const filtered = useMemo(
    () => allExercises.filter((e) => matchesExerciseSearchQuery(e, search)),
    [allExercises, search],
  );

  const normalizedSearch = normalizeExerciseDisplayName(search);
  const searchConflict = normalizedSearch
    ? EXERCISE_CATALOG.find((e) => e.id === normalizeExerciseIdentityKey(normalizedSearch))
    : undefined;
  const canAddCustom = normalizedSearch.length > 0 && filtered.length === 0 && !searchConflict;

  const normalizedRename = normalizeExerciseDisplayName(renameDraft);
  const renameCatalogConflict = normalizedRename
    ? EXERCISE_CATALOG.find((e) => e.id === normalizeExerciseIdentityKey(normalizedRename))
    : undefined;
  const renameCustomConflict = normalizedRename
    ? customExercises.find(
        (e) => e.id !== renameTarget?.id && matchesCustomExerciseNameOrAlias(e, normalizedRename),
      )
    : undefined;
  const renameHint = !renameTarget
    ? null
    : normalizedRename.length === 0
      ? "Enter a name for this custom exercise."
      : normalizedRename.toLowerCase() === renameTarget.name.toLowerCase()
        ? "Enter a different name."
        : renameCatalogConflict
          ? `Built-in exercise already exists: ${renameCatalogConflict.name}.`
          : renameCustomConflict
            ? `Custom exercise already exists: ${renameCustomConflict.name}.`
            : null;
  const canRename = !!renameTarget && normalizedRename.length > 0 && renameHint === null;

  const select = (exercise: ExerciseDefinition) => {
    onSelect(exercise);
    onClose();
  };

  const deleteCustom = (id: string) => {
    removeInPrograms(id);
    removeInWorkouts(id);
    removeCustomExercise(id);
  };

  const commitRename = () => {
    if (!renameTarget || !canRename) return;
    const renamed = renameCustomExercise(renameTarget.id, normalizedRename);
    if (!renamed) {
      showAlert("Rename failed", "Pick a different name for this custom exercise.");
      return;
    }
    renameInPrograms(renamed.id, renamed.name);
    renameInWorkouts(renamed.id, renamed.name);
    setRenameTarget(null);
    setRenameDraft("");
    if (renamed.id === selectedDefinitionId) onSelect(renamed);
  };

  const renderItem = ({ item }: { item: ExerciseDefinition }) => {
    const isSelected = item.id === selectedDefinitionId;
    const subtitle = item.muscles?.length
      ? formatMuscleLabels(item.muscles, " · ")
      : item.isCustom
        ? "Custom exercise"
        : "Uncategorized";
    const row = (
      <View
        style={[
          UI.inset,
          styles.item,
          item.isCustom && { backgroundColor: COLORS.CARD_BG },
          isSelected && styles.itemSelected,
        ]}
      >
        <Pressable onPress={() => select(item)} style={styles.itemMain}>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.body}>{item.name}</Text>
            <Text style={[TYPE.caption, { marginTop: SPACE.xs }]}>{subtitle}</Text>
          </View>
          {isSelected ? <Check size={18} color={COLORS.ACCENT_BLUE} /> : null}
        </Pressable>
        {item.isCustom ? (
          <IconButton
            size="sm"
            tone="success"
            onPress={() => {
              setRenameTarget(item);
              setRenameDraft(item.name);
            }}
            style={{ marginRight: SPACE.md }}
          >
            <Pencil size={14} color={COLORS.ACCENT_GREEN} />
          </IconButton>
        ) : null}
      </View>
    );
    return (
      <View style={styles.rowWrap}>
        {item.isCustom ? (
          <Swipeable
            onDelete={() => deleteCustom(item.id)}
            onToggleScroll={setScrollEnabled}
            borderRadius={RADIUS.item}
            marginBottom={0}
          >
            {row}
          </Swipeable>
        ) : (
          row
        )}
      </View>
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dragToClose
      title={title}
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
          placeholder="Search exercises..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          autoFocus
        />
      </View>

      {canAddCustom ? (
        <Pressable
          style={({ pressed }) => [styles.addCustom, pressed && UI.pressed]}
          onPress={() => select(addCustomExercise(normalizedSearch))}
        >
          <Text style={[TYPE.label, { color: COLORS.ACCENT_BLUE }]}>Add custom exercise</Text>
          <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>{normalizedSearch}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        renderItem={renderItem}
        ListEmptyComponent={
          !canAddCustom ? (
            <Text style={[TYPE.bodyMuted, styles.empty]}>No exercises found.</Text>
          ) : null
        }
      />

      <Sheet visible={!!renameTarget} onClose={() => setRenameTarget(null)} placement="center">
        <KeyboardAvoidingView behavior="padding">
          <Text style={[TYPE.label, { color: COLORS.ACCENT_GREEN }]}>Rename custom exercise</Text>
          <Text style={[TYPE.heading, { marginTop: SPACE.sm }]}>{renameTarget?.name}</Text>
          <TextInput
            ref={renameInputRef}
            style={[UI.inset, styles.renameInput]}
            value={renameDraft}
            onChangeText={setRenameDraft}
            placeholder="Exercise name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            returnKeyType="done"
            onSubmitEditing={commitRename}
          />
          {renameHint ? (
            <Text style={[TYPE.caption, { marginTop: SPACE.sm }]}>{renameHint}</Text>
          ) : null}
          <View style={styles.renameActions}>
            <Button
              label="Cancel"
              size="md"
              icon={<X size={14} color={buttonForeground()} />}
              onPress={() => setRenameTarget(null)}
              style={{ flex: 1 }}
            />
            <Button
              label="Save name"
              size="md"
              tone="success"
              variant="filled"
              icon={<Pencil size={14} color={buttonForeground("success", "filled")} />}
              onPress={commitRename}
              disabled={!canRename}
              style={{ flex: 1 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Sheet>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACE.xl,
    marginTop: SPACE.lg,
    marginBottom: SPACE.lg,
    paddingHorizontal: SPACE.lg,
  },
  searchInput: { ...TYPE.body, flex: 1, paddingVertical: SPACE.md + 2, marginLeft: SPACE.sm + 2 },
  addCustom: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
    backgroundColor: SURFACE.blueTint,
    borderWidth: 1,
    borderColor: SURFACE.blueBorder,
    borderRadius: RADIUS.container,
    padding: SPACE.lg,
  },
  list: { gap: SPACE.sm, paddingBottom: SPACE.lg },
  rowWrap: { marginHorizontal: SPACE.lg },
  item: { flexDirection: "row", alignItems: "center" },
  itemSelected: { borderColor: SURFACE.blueBorder, backgroundColor: SURFACE.blueTint },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  empty: { textAlign: "center", paddingVertical: SPACE.xxxl },
  renameInput: {
    ...TYPE.body,
    paddingHorizontal: SPACE.md + 2,
    paddingVertical: SPACE.md,
    marginTop: SPACE.md,
  },
  renameActions: { flexDirection: "row", gap: SPACE.sm + 2, marginTop: SPACE.lg },
});

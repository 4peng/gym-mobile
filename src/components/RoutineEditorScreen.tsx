import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpDown, Check, ChevronRight, Play, Plus, Save, Trash2, X } from "lucide-react-native";
import { showAlert } from "@/utils/alerts";
import { COLORS, LAYOUT, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import ExerciseEditor, {
  type ExerciseEditorPicker,
  type ExerciseFormData,
} from "@/components/ExerciseEditor";
import ExerciseReorderModal from "@/components/Workout/ExerciseReorderModal";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import MuscleSelector from "@/components/MuscleSelector";
import RestTimerPicker from "@/components/RestTimerPicker";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  buildRoutineDraft,
  createEmptyExercise,
  createRoutineSnapshot,
  validateRoutineDraft,
} from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import type { ExerciseDefinition } from "@/types";
import type { MuscleGroup } from "@/constants/muscles";
import { inferTrackingModeFromExerciseDefinition } from "@/utils/exerciseTracking";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";

export interface RoutineDraft {
  name: string;
  exercises: ExerciseFormData[];
}

interface RoutineEditorScreenProps {
  mode: "create" | "edit";
  initialName?: string;
  initialExercises?: ExerciseFormData[];
  onCancel: (draft: RoutineDraft, hasChanges: boolean) => void;
  onSave: (draft: RoutineDraft) => void;
  onSaveAndStart?: (draft: RoutineDraft) => void;
  onDelete?: (draft: RoutineDraft) => void;
}

const EMPTY_MUSCLES: MuscleGroup[] = [];

/** Which overlay is open; `add` appends a new exercise, the others edit one. */
type Picker = { kind: "add" } | { kind: ExerciseEditorPicker; exerciseId: string } | null;

/** Routine form: name, add/reorder exercises, per-exercise editors. */
export default function RoutineEditorScreen({
  mode,
  initialName = "",
  initialExercises = [],
  onCancel,
  onSave,
  onSaveAndStart,
  onDelete,
}: RoutineEditorScreenProps) {
  // Seeded once: the props derive from the store and may change identity mid-edit.
  const [name, setName] = useState(initialName);
  const [exercises, setExercises] = useState<ExerciseFormData[]>(initialExercises);
  const [picker, setPicker] = useState<Picker>(null);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const updateCustomExerciseMuscles = useExerciseLibraryStore((s) => s.updateCustomExerciseMuscles);
  const isCreate = mode === "create";

  const initialSnapshot = useMemo(
    () => createRoutineSnapshot(initialName, initialExercises),
    [initialExercises, initialName],
  );
  const hasChanges = createRoutineSnapshot(name, exercises) !== initialSnapshot;
  const totalSets = exercises.reduce((n, e) => n + (e.defaultSets?.length || 0), 0);
  const target =
    picker && "exerciseId" in picker
      ? exercises.find((e) => e.id === picker.exerciseId)
      : undefined;
  const closePicker = useCallback(() => setPicker(null), []);
  const openPicker = useCallback(
    (kind: ExerciseEditorPicker, exerciseId: string) => setPicker({ kind, exerciseId }),
    [],
  );

  const draft = useCallback(
    (): RoutineDraft => buildRoutineDraft(name, exercises) as RoutineDraft,
    [exercises, name],
  );

  const validate = () => {
    const error = validateRoutineDraft(name, exercises);
    if (error) showAlert("Error", error);
    return !error;
  };

  const handleUpdateExercise = useCallback(
    (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    },
    [],
  );
  const handleRemoveExercise = useCallback(
    (id: string) => setExercises((prev) => prev.filter((e) => e.id !== id)),
    [],
  );
  const handleExerciseSelect = (def: ExerciseDefinition) => {
    const fields = {
      exerciseDefinitionId: def.id,
      name: def.name,
      muscles: def.muscles,
      trackingMode: inferTrackingModeFromExerciseDefinition(def),
    };
    if (picker?.kind === "exercise") {
      handleUpdateExercise(picker.exerciseId, fields);
      return;
    }
    const next = { ...(createEmptyExercise(generateId) as ExerciseFormData), ...fields };
    setExercises((prev) => [...prev, next]);
  };
  const handleMusclesChange = (muscles: MuscleGroup[]) => {
    if (!target) return;
    handleUpdateExercise(target.id, { muscles });
    if (target.exerciseDefinitionId?.startsWith("custom-"))
      updateCustomExerciseMuscles(target.exerciseDefinitionId, muscles);
  };
  const handleReorder = useCallback((ids: string[]) => {
    setExercises((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      const next = ids.map((id) => byId.get(id)).filter((e): e is ExerciseFormData => !!e);
      return next.length === prev.length ? next : prev;
    });
  }, []);

  const doSave = () => validate() && onSave(draft());
  const doSaveAndStart = () => onSaveAndStart && validate() && onSaveAndStart(draft());
  const withOptionsClosed = (fn: () => void) => () => {
    setOptionsVisible(false);
    fn();
  };

  return (
    <KeyboardAvoidingView style={UI.screen} behavior="padding">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <IconButton tone="danger" onPress={() => onCancel(draft(), hasChanges)}>
            <X size={20} color={COLORS.DANGER} strokeWidth={2.8} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.body}>{isCreate ? "New routine" : "Edit routine"}</Text>
            <Text style={TYPE.caption}>{hasChanges ? "Unsaved changes" : "All changes saved"}</Text>
          </View>
          <IconButton tone="success" onPress={isCreate ? doSave : () => setOptionsVisible(true)}>
            <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={2.8} />
          </IconButton>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Routine name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            autoFocus={isCreate}
          />

          <View style={[UI.inset, styles.summary]}>
            <View style={styles.summaryItem}>
              <Text style={TYPE.mono}>{exercises.length}</Text>
              <Text style={TYPE.caption}>Exercises</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={TYPE.mono}>{totalSets}</Text>
              <Text style={TYPE.caption}>Sets</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Add exercise"
              tone="primary"
              icon={<Plus size={18} color={buttonForeground("primary")} />}
              onPress={() => setPicker({ kind: "add" })}
              style={{ flex: 1 }}
            />
            <Button
              label="Reorder"
              icon={<ArrowUpDown size={18} color={buttonForeground()} />}
              onPress={() => setReorderVisible(true)}
              disabled={exercises.length < 2}
              style={{ flex: 1 }}
            />
          </View>

          {exercises.map((item, index) => (
            <ExerciseEditor
              key={item.id}
              exercise={item}
              index={index}
              onUpdate={handleUpdateExercise}
              onRemove={handleRemoveExercise}
              onOpenPicker={openPicker}
            />
          ))}
          {exercises.length === 0 ? (
            <EmptyState
              title="No exercises yet"
              subtitle="Add one from the library to build the routine."
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Sheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        placement="center"
        title="Routine options"
      >
        <View style={styles.options}>
          <OptionItem
            icon={<Save size={20} color={COLORS.ACCENT_BLUE} />}
            title="Save changes"
            subtitle="Update the routine and go back"
            onPress={withOptionsClosed(doSave)}
          />
          {onSaveAndStart ? (
            <OptionItem
              icon={<Play size={20} color={COLORS.ACCENT_GREEN} fill={COLORS.ACCENT_GREEN} />}
              title="Save and start"
              subtitle="Launch this routine now"
              onPress={withOptionsClosed(doSaveAndStart)}
            />
          ) : null}
          {onDelete ? (
            <OptionItem
              icon={<Trash2 size={20} color={COLORS.DANGER} />}
              title="Delete routine"
              subtitle="Remove this routine permanently"
              danger
              onPress={withOptionsClosed(() => onDelete(draft()))}
            />
          ) : null}
        </View>
      </Sheet>

      <ExerciseReorderModal
        visible={reorderVisible}
        exercises={exercises.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setReorderVisible(false)}
        onSave={handleReorder}
      />
      <ExercisePickerModal
        visible={picker?.kind === "add" || picker?.kind === "exercise"}
        onClose={closePicker}
        onSelect={handleExerciseSelect}
        selectedDefinitionId={
          picker?.kind === "exercise" ? target?.exerciseDefinitionId : undefined
        }
        title={picker?.kind === "exercise" ? "Change exercise" : "Add exercise"}
      />
      <MuscleSelector
        visible={picker?.kind === "muscles"}
        onClose={closePicker}
        selectedMuscles={target?.muscles ?? EMPTY_MUSCLES}
        onSelect={handleMusclesChange}
      />
      <RestTimerPicker
        visible={picker?.kind === "rest"}
        initialSeconds={target?.restSeconds ?? 90}
        onClose={closePicker}
        onSave={(restSeconds) => {
          if (target) handleUpdateExercise(target.id, { restSeconds });
        }}
      />
    </KeyboardAvoidingView>
  );
}

function OptionItem({
  icon,
  title,
  subtitle,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, pressed && UI.pressed]}>
      <View style={[styles.optionIcon, danger && { backgroundColor: SURFACE.dangerTint }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, danger && { color: COLORS.DANGER }]}>{title}</Text>
        <Text style={TYPE.caption}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color={COLORS.TEXT_TERTIARY} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.hairline,
  },
  content: { paddingHorizontal: LAYOUT.gutter, paddingTop: SPACE.xxl, paddingBottom: 140 },
  nameInput: { ...TYPE.title, padding: 0, marginBottom: SPACE.lg },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    marginBottom: SPACE.xl,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryDivider: { width: 1, height: 24, backgroundColor: SURFACE.hairline },
  actions: { flexDirection: "row", gap: SPACE.md, marginBottom: SPACE.xxl },
  options: { paddingTop: SPACE.sm },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md, gap: SPACE.lg },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.item,
    backgroundColor: SURFACE.raisedStrong,
    justifyContent: "center",
    alignItems: "center",
  },
});

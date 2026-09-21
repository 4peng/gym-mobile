import { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { copyExercises, normalizeExercises } from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import RoutineEditorScreen, { type RoutineDraft } from "@/components/RoutineEditorScreen";
import type { ExerciseFormData } from "@/components/ExerciseEditor";
import type { Program, ProgramExercise } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { UI } from "@/constants/theme";
import { View } from "react-native";

interface ProgramEditorScreenProps {
  variant: "create" | "edit";
}

/** Wires the routine form to the program store. `create` may duplicate via `?sourceId=`. */
export default function ProgramEditorScreen({ variant }: ProgramEditorScreenProps) {
  const { id, sourceId } = useLocalSearchParams<{ id?: string; sourceId?: string | string[] }>();
  const router = useRouter();
  const addProgram = useProgramStore((s) => s.addProgram);
  const updateProgram = useProgramStore((s) => s.updateProgram);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const programs = useProgramStore((s) => s.programs);
  const hasActiveSession = useWorkoutSessionStore((s) => s.activeSession !== null);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);

  const program = useMemo(
    () => (variant === "edit" && id ? programs.find((p) => p._id === id) : undefined),
    [id, programs, variant],
  );
  const source = useMemo(() => {
    const sid = Array.isArray(sourceId) ? sourceId[0] : sourceId;
    return variant === "create" && sid ? programs.find((p) => p._id === sid) : undefined;
  }, [programs, sourceId, variant]);

  const initialName =
    variant === "edit" ? (program?.name ?? "") : source ? `${source.name} Copy` : "";
  const initialExercises = useMemo(
    () =>
      (variant === "edit"
        ? normalizeExercises(program?.exercises as ProgramExercise[])
        : copyExercises(source?.exercises as ProgramExercise[], generateId)) as ExerciseFormData[],
    [program, source, variant],
  );

  /** Writes the draft over the existing program and returns the merged copy. */
  const applyUpdate = useCallback(
    (draft: RoutineDraft): Program | null => {
      if (!id || !program) return null;
      const updates = {
        name: draft.name,
        exercises: normalizeExercises(draft.exercises) as ProgramExercise[],
      };
      updateProgram(id, updates);
      return { ...program, ...updates };
    },
    [id, program, updateProgram],
  );

  const handleSave = (draft: RoutineDraft) => {
    if (variant === "edit") applyUpdate(draft);
    else addProgram(draft.name, copyExercises(draft.exercises, generateId) as ProgramExercise[]);
    router.back();
  };

  const handleSaveAndStart = (draft: RoutineDraft) => {
    const next = applyUpdate(draft);
    if (!next) return;
    const start = () => {
      startFromProgram(next);
      router.replace("/workout");
    };
    if (hasActiveSession)
      showConfirm(
        "Active workout",
        "You already have a workout in progress. Discard it and start this one?",
        start,
      );
    else start();
  };

  const handleDelete = () => {
    if (!id || !program) return;
    showConfirm("Delete routine", `Delete "${program.name}"? This cannot be undone.`, () => {
      deleteProgram(id);
      router.push("/programs/");
    });
  };

  const handleCancel = (_draft: RoutineDraft, hasChanges: boolean) => {
    if (!hasChanges) return router.back();
    showConfirm(
      "Discard changes",
      variant === "edit" ? "Your unsaved edits will be lost." : "Your new routine will be lost.",
      () => router.back(),
    );
  };

  if (variant === "edit" && !program) {
    return (
      <View style={[UI.screen, { justifyContent: "center" }]}>
        <EmptyState title="Routine not found" subtitle="It may have been deleted." />
      </View>
    );
  }

  return (
    <RoutineEditorScreen
      mode={variant}
      initialName={initialName}
      initialExercises={initialExercises}
      onCancel={handleCancel}
      onSave={handleSave}
      onSaveAndStart={variant === "edit" ? handleSaveAndStart : undefined}
      onDelete={variant === "edit" ? handleDelete : undefined}
    />
  );
}

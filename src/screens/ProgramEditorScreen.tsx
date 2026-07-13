import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppParams, useAppRouter } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { copyExercises, normalizeExercises } from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import RoutineEditorScreen, { type RoutineDraft } from "@/components/RoutineEditorScreen";
import type { Program, ProgramExercise } from "@/types";

type ProgramEditorVariant = "create" | "edit";

interface ProgramEditorScreenProps {
  variant: ProgramEditorVariant;
}

function toProgramUpdates(draft: RoutineDraft): Partial<Program> {
  return {
    name: draft.name,
    exercises: normalizeExercises(draft.exercises as any) as any as ProgramExercise[],
  };
}

const getProgramName = (program: Program | undefined) => {
  if (!program?.name) return "this routine";
  return `"${program.name}"`;
};

export default function ProgramEditorScreen({ variant }: ProgramEditorScreenProps) {
  const { id, sourceId } = useAppParams<{ id?: string; sourceId?: string | string[] }>();
  const normalizedSourceId = Array.isArray(sourceId) ? sourceId[0] : sourceId;

  const router = useAppRouter();

  const addProgram = useProgramStore((s) => s.addProgram);
  const updateProgram = useProgramStore((s) => s.updateProgram);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const programs = useProgramStore((s) => s.programs);

  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);

  const program = useMemo(
    () => (variant === "edit" && id ? programs.find((item) => item._id === id) : undefined),
    [id, programs, variant]
  );

  const sourceProgram = useMemo(
    () => (
      variant === "create" && normalizedSourceId
        ? programs.find((item) => item._id === normalizedSourceId)
        : undefined
    ),
    [normalizedSourceId, programs, variant]
  );

  const editorMode = variant === "edit" ? "edit" : sourceProgram ? "duplicate" : "create";

  const initialName = useMemo(() => {
    if (variant === "edit") {
      return program?.name || "";
    }

    return sourceProgram?.name ? `${sourceProgram.name} Copy` : "";
  }, [program, sourceProgram, variant]);

  const initialExercises = useMemo(() => {
    if (variant === "edit") {
      return normalizeExercises(program?.exercises as any) as any;
    }

    return copyExercises(sourceProgram?.exercises as any, generateId) as any;
  }, [program, sourceProgram, variant]);

  const applyUpdate = useCallback((draft: RoutineDraft): Program | null => {
    if (variant !== "edit" || !id || !program) return null;

    const updates = toProgramUpdates(draft);
    updateProgram(id, updates);
    return {
      ...program,
      ...updates,
    };
  }, [id, program, updateProgram, variant]);

  const handleSave = useCallback((draft: RoutineDraft) => {
    try {
      if (variant === "edit") {
        applyUpdate(draft);
      } else {
        addProgram(draft.name, copyExercises(draft.exercises as any, generateId) as any);
      }

      router.back();
    } catch {
      showAlert("Error", "An unexpected error occurred while saving.");
    }
  }, [addProgram, applyUpdate, router, variant]);

  const handleSaveAndStart = useCallback((draft: RoutineDraft) => {
    try {
      const nextProgram = applyUpdate(draft);

      if (!nextProgram) return;

      if (activeSession) {
        showConfirm(
          "Active Workout",
          "You already have a workout in progress. Discard it and start this one?",
          () => {
            startFromProgram(nextProgram!);
            router.replace("/workout");
          }
        );
        return;
      }

      startFromProgram(nextProgram);
      router.replace("/workout");
    } catch {
      showAlert("Error", "An unexpected error occurred while saving.");
    }
  }, [activeSession, applyUpdate, router, startFromProgram]);

  const handleDelete = useCallback((_draft: RoutineDraft) => {
    if (variant !== "edit" || !id || !program) return;

    showConfirm(
      "Delete Routine",
      `Are you sure you want to delete ${getProgramName(program)}? This cannot be undone.`,
      () => {
        deleteProgram(id);
        router.push("/programs/");
      }
    );
  }, [deleteProgram, id, program, router, variant]);

  const handleCancel = useCallback((_draft: RoutineDraft, hasChanges: boolean) => {
    if (!hasChanges) {
      router.back();
      return;
    }

    showConfirm(
      "Discard Changes",
      variant === "edit"
        ? "Your unsaved edits will be lost. Discard them?"
        : "Your new routine draft will be lost. Discard it?",
      () => router.back()
    );
  }, [router, variant]);

  if (variant === "edit" && !program) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundLabel}>ROUTINE TARGET</Text>
        <Text style={styles.notFoundText}>NOT FOUND</Text>
      </View>
    );
  }

  return (
    <RoutineEditorScreen
      mode={editorMode}
      initialName={initialName}
      initialExercises={initialExercises}
      onCancel={handleCancel}
      onSave={handleSave}
      onSaveAndStart={variant === "edit" ? handleSaveAndStart : undefined}
      onDelete={variant === "edit" ? handleDelete : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  notFoundLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  notFoundText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
});

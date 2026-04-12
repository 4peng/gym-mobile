'use client';

import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppRouter, useAppParams } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { normalizeExercises } from "@/shared/programs.js";
import RoutineEditorScreen, { type RoutineDraft } from "@/components/RoutineEditorScreen";
import type { Program } from "@/types";

function toProgramUpdates(draft: RoutineDraft): Partial<Program> {
  return {
    name: draft.name,
    exercises: normalizeExercises(draft.exercises),
  };
}

export default function EditProgramScreen() {
  const { id } = useAppParams<{ id: string }>();
  const router = useAppRouter();

  const program = useProgramStore((s) => s.programs.find((p) => p._id === id));
  const updateProgram = useProgramStore((s) => s.updateProgram);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);

  const initialExercises = useMemo(
    () => normalizeExercises(program?.exercises || []),
    [program]
  );

  const applyUpdate = useCallback(
    (draft: RoutineDraft): Program | null => {
      if (!id || !program) return null;

      const updates = toProgramUpdates(draft);
      updateProgram(id, updates);
      return {
        ...program,
        ...updates,
      };
    },
    [id, program, updateProgram]
  );

  const handleSave = useCallback(
    (draft: RoutineDraft) => {
      try {
        applyUpdate(draft);
        router.back();
      } catch {
        showAlert("Error", "An unexpected error occurred while saving.");
      }
    },
    [applyUpdate, router]
  );

  const handleSaveAndStart = useCallback(
    (draft: RoutineDraft) => {
      try {
        const updatedProgram = applyUpdate(draft);
        if (!updatedProgram) return;

        if (activeSession) {
          showConfirm(
            "Active Workout",
            "You already have a workout in progress. Discard it and start this one?",
            () => {
              startFromProgram(updatedProgram);
              router.replace("/workout");
            }
          );
          return;
        }

        startFromProgram(updatedProgram);
        router.replace("/workout");
      } catch {
        showAlert("Error", "An unexpected error occurred while saving.");
      }
    },
    [applyUpdate, activeSession, startFromProgram, router]
  );

  const handleDelete = useCallback(
    (_draft: RoutineDraft) => {
      if (!id || !program) return;
      showConfirm(
        "Delete Routine",
        `Are you sure you want to delete "${program.name}"? This cannot be undone.`,
        () => {
          deleteProgram(id);
          router.push("/programs/");
        }
      );
    },
    [id, program, deleteProgram, router]
  );

  const handleCancel = useCallback(
    (_draft: RoutineDraft, _hasChanges: boolean) => {
      showConfirm("Discard Changes", "Are you sure you want to discard your edits?", () =>
        router.back()
      );
    },
    [router]
  );

  if (!program) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFoundText}>Not Found</Text>
      </View>
    );
  }

  return (
    <RoutineEditorScreen
      mode="edit"
      initialName={program.name || ""}
      initialExercises={initialExercises}
      onCancel={handleCancel}
      onSave={handleSave}
      onSaveAndStart={handleSaveAndStart}
      onDelete={handleDelete}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "900",
  },
});

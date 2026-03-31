'use client';

import React, { useCallback } from "react";
import { useMemo } from "react";
import { useAppParams, useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { copyExercises } from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import RoutineEditorScreen, { type RoutineDraft } from "@/components/RoutineEditorScreen";

export default function CreateProgramScreen() {
  const { sourceId } = useAppParams<{ sourceId?: string | string[] }>();
  const normalizedSourceId = Array.isArray(sourceId) ? sourceId[0] : sourceId;
  const addProgram = useProgramStore((s) => s.addProgram);
  const sourceProgram = useProgramStore((s) =>
    normalizedSourceId ? s.programs.find((p) => p._id === normalizedSourceId) : undefined
  );
  const router = useAppRouter();

  const initialName = useMemo(
    () => (sourceProgram?.name ? `${sourceProgram.name} Copy` : ""),
    [sourceProgram]
  );
  const initialExercises = useMemo(
    () => copyExercises(sourceProgram?.exercises || [], generateId),
    [sourceProgram]
  );

  const handleSave = useCallback(
    (draft: RoutineDraft) => {
      addProgram(draft.name, copyExercises(draft.exercises, generateId));
      router.back();
    },
    [addProgram, router]
  );

  const handleCancel = useCallback(
    (_draft: RoutineDraft, hasChanges: boolean) => {
      if (!hasChanges) {
        router.back();
        return;
      }
      showConfirm(
        "Discard Changes",
        "Your unsaved changes will be lost. Discard?",
        () => router.back()
      );
    },
    [router]
  );

  return (
    <RoutineEditorScreen
      mode={sourceProgram ? "duplicate" : "create"}
      initialName={initialName}
      initialExercises={initialExercises}
      onCancel={handleCancel}
      onSave={handleSave}
    />
  );
}

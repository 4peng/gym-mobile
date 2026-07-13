import React from "react";
import type { ExerciseDefinition } from "@/types";
import ExercisePickerModal from "@/components/ExercisePickerModal";

interface ExercisePickerFieldProps {
  selectedDefinitionId?: string;
  onSelect: (exercise: ExerciseDefinition) => void;
  visible: boolean;
  onClose: () => void;
}

export default function ExercisePickerField({
  selectedDefinitionId,
  onSelect,
  visible,
  onClose,
}: ExercisePickerFieldProps) {
  return (
    <ExercisePickerModal
      visible={visible}
      onClose={onClose}
      onSelect={onSelect}
      selectedDefinitionId={selectedDefinitionId}
    />
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Menu, Plus, X } from "lucide-react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useShallow } from "zustand/react/shallow";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { HapticFeedback } from "@/utils/haptics";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { Swipeable } from "@/components/Swipeable";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";

interface ExerciseMeta {
  id: string;
  name: string;
}

const NavMenuItem = React.memo(function NavMenuItem({
  item,
  index,
  drag,
  isActive,
  isFocused,
  onPress,
  onDelete,
}: {
  item: ExerciseMeta;
  index: number;
  drag: () => void;
  isActive: boolean;
  isFocused: boolean;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ScaleDecorator>
      <Swipeable onDelete={() => onDelete(item.id)} borderRadius={RADIUS.item} marginBottom={0}>
        <Pressable
          onPress={() => onPress(item.id)}
          onLongPress={drag}
          delayLongPress={200}
          disabled={isActive}
          style={[
            UI.inset,
            styles.item,
            isFocused && styles.itemFocused,
            isActive && styles.itemDragging,
          ]}
        >
          <Text style={TYPE.monoSmall}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={[TYPE.mono, styles.itemName, isFocused && { color: COLORS.ACCENT_BLUE }]}>
            {item.name.toUpperCase()}
          </Text>
          <Menu size={14} color={COLORS.TEXT_TERTIARY} />
        </Pressable>
      </Swipeable>
    </ScaleDecorator>
  );
});

interface ExerciseNavMenuProps {
  visible: boolean;
  onClose: () => void;
  activeExerciseId: string | null;
  onSelect: (id: string) => void;
  onAddPress: () => void;
}

/** Bottom sheet listing the session's exercises: tap to jump, drag to reorder, swipe to remove. */
export default function ExerciseNavMenu({
  visible,
  onClose,
  activeExerciseId,
  onSelect,
  onAddPress,
}: ExerciseNavMenuProps) {
  const exerciseIds = useWorkoutSessionStore(
    useShallow((s) => s.activeSession?.exercises.map((e) => e.id) ?? []),
  );
  const exerciseNames = useWorkoutSessionStore(
    useShallow((s) => s.activeSession?.exercises.map((e) => e.name) ?? []),
  );
  const reorderExercises = useWorkoutSessionStore((s) => s.reorderExercises);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);

  const exercises = useMemo(
    () => exerciseIds.map((id, i) => ({ id, name: exerciseNames[i] })),
    [exerciseIds, exerciseNames],
  );
  const [dragList, setDragList] = useState<ExerciseMeta[]>(exercises);
  useEffect(() => {
    if (visible) setDragList(exercises);
  }, [visible, exercises]);

  const handleDelete = useCallback(
    (id: string) => {
      removeExercise(id);
      HapticFeedback.heavy();
    },
    [removeExercise],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<ExerciseMeta>) => (
      <NavMenuItem
        item={item}
        index={getIndex() ?? 0}
        drag={drag}
        isActive={isActive}
        isFocused={item.id === activeExerciseId}
        onPress={(id) => {
          onSelect(id);
          onClose();
        }}
        onDelete={handleDelete}
      />
    ),
    [activeExerciseId, onSelect, onClose, handleDelete],
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Exercises"
      headerRight={
        <IconButton size="md" ghost onPress={onClose}>
          <X size={20} color={COLORS.DANGER} />
        </IconButton>
      }
    >
      <DraggableFlatList
        data={dragList}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => {
          setDragList(data);
          setTimeout(() => {
            reorderExercises(data.map((e) => e.id));
            HapticFeedback.success();
          }, 0);
        }}
        onDragBegin={() => HapticFeedback.light()}
        activationDistance={15}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && UI.pressed]}
            onPress={() => {
              onClose();
              onAddPress();
            }}
          >
            <Plus size={16} color={COLORS.ACCENT_GREEN} />
            <Text style={[TYPE.label, { color: COLORS.ACCENT_GREEN }]}>Add new exercise</Text>
          </Pressable>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACE.lg, gap: SPACE.sm },
  item: { flexDirection: "row", alignItems: "center", padding: SPACE.lg, gap: SPACE.lg },
  itemFocused: { backgroundColor: SURFACE.blueTint, borderColor: SURFACE.blueBorder },
  itemDragging: { backgroundColor: SURFACE.blueTintStrong, borderColor: COLORS.ACCENT_BLUE },
  itemName: { flex: 1 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm + 2,
    marginTop: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: SURFACE.greenBorder,
    borderStyle: "dashed",
  },
});

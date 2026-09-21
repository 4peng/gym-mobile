import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, GripVertical, X } from "lucide-react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { HapticFeedback } from "@/utils/haptics";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";

interface ReorderItem {
  id: string;
  name: string;
}

const ReorderRow = React.memo(function ReorderRow({
  item,
  index,
  drag,
  isActive,
}: {
  item: ReorderItem;
  index: number;
  drag: () => void;
  isActive: boolean;
}) {
  return (
    <ScaleDecorator>
      <View style={[UI.inset, styles.row, isActive && styles.rowActive]}>
        <View style={styles.badge}>
          <Text style={[TYPE.monoSmall, { color: COLORS.ACCENT_BLUE }]}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
        <Text style={[TYPE.mono, styles.label]} numberOfLines={1}>
          {item.name.toUpperCase()}
        </Text>
        <GesturePressable
          onLongPress={drag}
          disabled={isActive}
          delayLongPress={120}
          hitSlop={12}
          style={styles.handle}
        >
          <GripVertical size={18} color={isActive ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY} />
        </GesturePressable>
      </View>
    </ScaleDecorator>
  );
});

interface ExerciseReorderModalProps {
  visible: boolean;
  exercises: ReorderItem[];
  onClose: () => void;
  onSave: (exerciseIds: string[]) => void;
}

/** Drag-to-reorder dialog for a routine's exercises. */
export default function ExerciseReorderModal({
  visible,
  exercises,
  onClose,
  onSave,
}: ExerciseReorderModalProps) {
  const [draft, setDraft] = useState<ReorderItem[]>(exercises);
  useEffect(() => {
    if (visible) setDraft(exercises);
  }, [visible, exercises]);

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<ReorderItem>) => (
      <ReorderRow item={item} index={getIndex() ?? 0} drag={drag} isActive={isActive} />
    ),
    [],
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      placement="center"
      title="Reorder"
      headerLeft={
        <IconButton size="md" tone="danger" onPress={onClose}>
          <X size={20} color={COLORS.DANGER} />
        </IconButton>
      }
      headerRight={
        <IconButton
          size="md"
          tone="success"
          onPress={() => {
            onSave(draft.map((e) => e.id));
            onClose();
          }}
        >
          <Check size={20} color={COLORS.ACCENT_GREEN} />
        </IconButton>
      }
    >
      <DraggableFlatList
        data={draft}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragBegin={() => HapticFeedback.selection()}
        onDragEnd={({ data }) => {
          setDraft(data);
          HapticFeedback.success();
        }}
        contentContainerStyle={styles.list}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.sm, paddingTop: SPACE.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    height: 60,
    paddingHorizontal: SPACE.md,
  },
  rowActive: { borderColor: COLORS.ACCENT_BLUE, backgroundColor: SURFACE.blueTint },
  badge: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1 },
  handle: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});

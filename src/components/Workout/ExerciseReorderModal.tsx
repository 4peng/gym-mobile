import React, { useCallback, useEffect, useState } from "react";
import { useSheet } from "@/hooks/useSheet";
import { Pressable, StyleSheet, Text, View, Animated } from "react-native";
import { Check, GripVertical, X } from "lucide-react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { HapticFeedback } from "@/utils/haptics";

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
      <View style={[styles.row, isActive && styles.rowActive]}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{String(index + 1).padStart(2, "0")}</Text>
        </View>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {item.name.toUpperCase()}
        </Text>
        <GesturePressable
          onLongPress={drag}
          disabled={isActive}
          delayLongPress={120}
          hitSlop={12}
          style={styles.dragHandle}
        >
          <GripVertical size={18} color={isActive ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY} />
        </GesturePressable>
      </View>
    </ScaleDecorator>
  );
});

export default function ExerciseReorderModal({
  visible,
  exercises,
  onClose,
  onSave,
}: {
  visible: boolean;
  exercises: ReorderItem[];
  onClose: () => void;
  onSave: (exerciseIds: string[]) => void;
}) {
  const [draftOrder, setDraftOrder] = useState<ReorderItem[]>(exercises);
  const { mounted, progress } = useSheet(visible);
  useEffect(() => {
    if (visible) setDraftOrder(exercises);
  }, [visible, exercises]);

  const handleSave = useCallback(() => {
    onSave(draftOrder.map((ex) => ex.id));
    onClose();
  }, [draftOrder, onClose, onSave]);

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<ReorderItem>) => (
      <ReorderRow item={item} index={getIndex() ?? 0} drag={drag} isActive={isActive} />
    ),
    [],
  );

  if (!mounted) return null;

  return (
    <View style={styles.absoluteOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={UI.SHARED.dangerBtn}>
            <X size={20} color={COLORS.DANGER} />
          </Pressable>
          <Text style={styles.title}>REORDER</Text>
          <Pressable onPress={handleSave} style={UI.SHARED.actionBtn}>
            <Check size={20} color={COLORS.ACCENT_GREEN} />
          </Pressable>
        </View>
        <DraggableFlatList
          data={draftOrder}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragBegin={() => HapticFeedback.selection()}
          onDragEnd={({ data }) => {
            setDraftOrder(data);
            HapticFeedback.success();
          }}
          contentContainerStyle={styles.listContent}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)" },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 16,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MONO,
    letterSpacing: 2,
  },
  listContent: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 12,
  },
  rowActive: { borderColor: COLORS.ACCENT_BLUE, backgroundColor: "rgba(0,122,255,0.05)" },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MONO,
  },
  rowLabel: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
  },
  dragHandle: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});

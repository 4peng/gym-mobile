import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, GripVertical, X } from "lucide-react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView, Pressable as GesturePressable } from "react-native-gesture-handler";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { HapticFeedback } from "@/utils/haptics";

interface ReorderItem {
  id: string;
  name: string;
}

interface ExerciseReorderModalProps {
  visible: boolean;
  exercises: ReorderItem[];
  onClose: () => void;
  onSave: (exerciseIds: string[]) => void;
}

function displayName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled Exercise";
}

export default function ExerciseReorderModal({
  visible,
  exercises,
  onClose,
  onSave,
}: ExerciseReorderModalProps) {
  const [draftOrder, setDraftOrder] = useState<ReorderItem[]>(exercises);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraftOrder(exercises);
    setIsDragging(false);
  }, [exercises, visible]);

  const orderIndexById = useMemo(
    () => new Map(draftOrder.map((exercise, index) => [exercise.id, index])),
    [draftOrder]
  );

  const handleSave = useCallback(() => {
    const orderedIds = draftOrder.map((exercise) => exercise.id);
    onClose();
    requestAnimationFrame(() => {
      onSave(orderedIds);
    });
  }, [draftOrder, onClose, onSave]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ReorderItem>) => (
      <ScaleDecorator>
        <View style={[styles.row, isActive && styles.rowActive]}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>
              {String((orderIndexById.get(item.id) ?? 0) + 1).padStart(2, "0")}
            </Text>
          </View>

          <Text style={styles.rowLabel} numberOfLines={1}>
            {displayName(item.name)}
          </Text>

          <GesturePressable
            onLongPress={drag}
            disabled={isActive}
            delayLongPress={120}
            hitSlop={12}
            style={({ pressed }) => [
              styles.dragHandle,
              pressed && !isActive && styles.dragHandlePressed,
            ]}
          >
            <GripVertical
              size={18}
              color={isActive ? COLORS.TEXT_PRIMARY : COLORS.TEXT_TERTIARY}
            />
          </GesturePressable>
        </View>
      </ScaleDecorator>
    ),
    [orderIndexById]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          pointerEvents={isDragging ? "none" : "auto"}
        />

        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn}>
              <X size={22} color={COLORS.DANGER} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Reorder Exercises</Text>
              <Text style={styles.subtitle}>Long press the handle and drag.</Text>
            </View>
            <Pressable
              onPress={handleSave}
              style={styles.headerBtn}
              disabled={isDragging}
            >
              <Check size={22} color={COLORS.ACCENT_GREEN} />
            </Pressable>
          </View>

          <View style={styles.listContainer}>
            {draftOrder.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No exercises to reorder.</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={draftOrder}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                onDragBegin={() => {
                  setIsDragging(true);
                  HapticFeedback.selection();
                }}
                onRelease={() => {
                  setIsDragging(false);
                }}
                onDragEnd={({ data }) => {
                  setDraftOrder(data);
                  setIsDragging(false);
                  HapticFeedback.selection();
                }}
                activationDistance={8}
                autoscrollThreshold={64}
                autoscrollSpeed={180}
                dragItemOverflow
                containerStyle={styles.dragList}
                contentContainerStyle={styles.dragListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 22,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  subtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 4,
  },
  listContainer: {
    maxHeight: 420,
  },
  dragList: {
    flexGrow: 0,
  },
  dragListContent: {
    gap: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 70,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowActive: {
    backgroundColor: "rgba(11, 130, 255, 0.12)",
    borderColor: "rgba(11, 130, 255, 0.35)",
  },
  indexBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(11, 130, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  rowLabel: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  dragHandle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandlePressed: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emptyState: {
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});

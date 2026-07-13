import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View, Animated, Easing, Dimensions } from "react-native";
import { X, Plus, Menu } from "lucide-react-native";
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from "react-native-draggable-flatlist";
import { useShallow } from "zustand/react/shallow";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { HapticFeedback } from "@/utils/haptics";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { Swipeable } from "@/components/Swipeable";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExerciseMeta { id: string; name: string; }

const NavMenuItem = React.memo(({ item, index, drag, isActive, isFocused, onPress, onDelete }: { item: ExerciseMeta; index: number; drag: () => void; isActive: boolean; isFocused: boolean; onPress: (id: string) => void; onDelete: (id: string) => void; }) => {
  return (<ScaleDecorator><Swipeable onDelete={() => onDelete(item.id)} borderRadius={UI.RADIUS_ITEM} marginBottom={0}><Pressable onPress={() => onPress(item.id)} onLongPress={drag} delayLongPress={200} disabled={isActive} style={[styles.navMenuItem, isFocused && styles.navMenuItemActive, isActive && styles.navMenuItemDragging]}><Text style={styles.navMenuIndex}>{(index + 1).toString().padStart(2, '0')}</Text><Text style={[styles.navMenuName, isFocused && { color: COLORS.ACCENT_BLUE }]}>{item.name.toUpperCase()}</Text><Menu size={14} color={COLORS.TEXT_TERTIARY} /></Pressable></Swipeable></ScaleDecorator>);
});

export default function ExerciseNavMenu({ visible, onClose, activeExerciseId, onSelect, onAddPress }: { visible: boolean; onClose: () => void; activeExerciseId: string | null; onSelect: (id: string) => void; onAddPress: () => void; }) {
  const exerciseDataStrings = useWorkoutSessionStore(useShallow((s) => s.activeSession?.exercises.map(e => `${e.id}|${e.name}`) || []));
  const reorderExercises = useWorkoutSessionStore((s) => s.reorderExercises);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const localExercises = useMemo(() => exerciseDataStrings.map(str => { const [id, name] = str.split('|'); return { id, name }; }), [exerciseDataStrings]);
  const [dragList, setDragList] = useState<ExerciseMeta[]>(localExercises);
  const animValue = useRef(new Animated.Value(0)).current;
  const [renderVisible, setRenderVisible] = useState(visible);
  useEffect(() => { if (visible) { setRenderVisible(true); Animated.timing(animValue, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); } else { Animated.timing(animValue, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setRenderVisible(false)); } }, [visible]);
  useEffect(() => { if (visible) setDragList(localExercises); }, [visible, localExercises]);
  const handleDragEnd = useCallback(({ data }: { data: ExerciseMeta[] }) => { setDragList(data); setTimeout(() => { reorderExercises(data.map(ex => ex.id)); HapticFeedback.success(); }, 0); }, [reorderExercises]);
  const handleDelete = useCallback((id: string) => { removeExercise(id); HapticFeedback.heavy(); }, [removeExercise]);
  const renderItem = useCallback(({ item, drag, isActive, getIndex }: RenderItemParams<ExerciseMeta>) => { const index = getIndex(); return (<NavMenuItem item={item} index={index ?? 0} drag={drag} isActive={isActive} isFocused={item.id === activeExerciseId} onPress={(id) => { onSelect(id); onClose(); }} onDelete={handleDelete} />); }, [activeExerciseId, onSelect, onClose, handleDelete]);
  if (!renderVisible) return null;
  const backdropOpacity = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const sheetTranslateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT * 0.8, 0] });
  return (
    <View style={styles.absoluteContainer} pointerEvents="box-none">
      <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /></Animated.View>
      <Animated.View style={[styles.navMenuSheet, { transform: [{ translateY: sheetTranslateY }] }]}><View style={styles.navMenuHeader}><Text style={styles.navMenuTitle}>EXERCISES</Text><Pressable onPress={onClose} hitSlop={12}><X size={20} color={COLORS.DANGER} /></Pressable></View><DraggableFlatList data={dragList} keyExtractor={(item) => item.id} onDragEnd={handleDragEnd} onDragBegin={() => HapticFeedback.light()} activationDistance={15} contentContainerStyle={styles.navMenuList} renderItem={renderItem} ListFooterComponent={<Pressable style={styles.navMenuAddBtn} onPress={() => { onClose(); onAddPress(); }}><Plus size={16} color={COLORS.ACCENT_GREEN} /><Text style={styles.navMenuAddText}>ADD NEW EXERCISE</Text></Pressable>} /></Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  navMenuSheet: { backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 40, borderWidth: 1, borderColor: COLORS.BORDER },
  navMenuHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  navMenuTitle: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontFamily: FONT_FAMILIES.MONO, fontWeight: "900", letterSpacing: 2 },
  navMenuList: { padding: 16, gap: 8 },
  navMenuItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: UI.RADIUS_ITEM, backgroundColor: "rgba(255,255,255,0.03)", gap: 16 },
  navMenuItemActive: { backgroundColor: "rgba(0, 122, 255, 0.08)", borderWidth: 1, borderColor: "rgba(0, 122, 255, 0.2)" },
  navMenuItemDragging: { backgroundColor: "rgba(0, 122, 255, 0.15)", borderColor: COLORS.ACCENT_BLUE, borderWidth: 1 },
  navMenuIndex: { color: COLORS.TEXT_TERTIARY, fontSize: 12, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  navMenuName: { flex: 1, color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: "800", fontFamily: FONT_FAMILIES.MONO },
  navMenuAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, padding: 16, borderRadius: UI.RADIUS_ITEM, borderWidth: 1, borderColor: "rgba(0, 255, 153, 0.2)", borderStyle: "dashed" },
  navMenuAddText: { color: COLORS.ACCENT_GREEN, fontSize: 12, fontWeight: "900", fontFamily: FONT_FAMILIES.MONO },
});

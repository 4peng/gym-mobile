import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation, Keyboard } from "react-native";
import { Check, X } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import type { ExerciseTrackingMode, WorkoutSet } from "@/types";
import { resolveSetOnComplete, type SetPlaceholder } from "@/utils/placeholders";
import { HapticFeedback } from "@/utils/haptics";

interface SetRowProps { set: WorkoutSet; index: number; placeholder: SetPlaceholder; exerciseId: string; exerciseName: string; restSeconds: number; trackingMode: ExerciseTrackingMode; weightUnit: "kg" | "lbs"; }

function InputBlock({ value, placeholder, keyboardType, onChangeText, onBlur, onFocus, completed, style }: { value: string; placeholder: string; keyboardType: "decimal-pad" | "number-pad" | "numeric"; onChangeText: (text: string) => void; onBlur?: () => void; onFocus?: () => void; completed: boolean; style?: any; }) {
  const inputRef = useRef<TextInput>(null);
  const handlePress = useCallback(() => { inputRef.current?.focus(); }, []);
  return (<Pressable onPress={handlePress} style={[styles.inputCell, style]}><TextInput ref={inputRef} style={[styles.inputText, completed && styles.inputTextCompleted]} keyboardType={keyboardType} value={value} placeholder={placeholder} placeholderTextColor={COLORS.TEXT_TERTIARY} onChangeText={onChangeText} onBlur={onBlur} onFocus={onFocus} /></Pressable>);
}

export const SetRow = React.memo<SetRowProps>(function SetRow({ set, index, placeholder, exerciseId, exerciseName, restSeconds, trackingMode, weightUnit }) {
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);
  const toggleSetCompletion = useWorkoutSessionStore((s) => s.toggleSetCompletion);
  const toggleSetType = useWorkoutSessionStore((s) => s.toggleSetType);
  const removeSet = useWorkoutSessionStore((s) => s.removeSet);
  const startRestTimer = useWorkoutSessionStore((s) => s.startRestTimer);
  const decimalKeyboardType = "decimal-pad";
  const [weightDraft, setWeightDraft] = useState(set.weight !== null ? String(set.weight) : "");
  const [distanceDraft, setDistanceDraft] = useState(set.distance !== null && set.distance !== undefined ? String(set.distance) : "");
  const [isWeightFocused, setIsWeightFocused] = useState(false);
  const [isDistanceFocused, setIsDistanceFocused] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const isCompleted = !!set.completedAt;
  useEffect(() => { if (isWeightFocused) return; setWeightDraft(set.weight !== null ? String(set.weight) : ""); }, [isWeightFocused, set.weight]);
  useEffect(() => { if (isDistanceFocused) return; setDistanceDraft(set.distance !== null && set.distance !== undefined ? String(set.distance) : ""); }, [isDistanceFocused, set.distance]);
  const handleWeightChange = useCallback((text: string) => { const normalizedText = text.replace(",", "."); setWeightDraft(normalizedText); if (normalizedText === "") { updateSet(exerciseId, set.id, "weight", null); return; } if (normalizedText === ".") return; const val = Number(normalizedText); if (!Number.isFinite(val)) return; updateSet(exerciseId, set.id, "weight", val); }, [exerciseId, set.id, updateSet]);
  const handleWeightBlur = useCallback(() => { setIsWeightFocused(false); const normalizedText = weightDraft.trim().replace(",", "."); if (normalizedText === "") { setWeightDraft(""); updateSet(exerciseId, set.id, "weight", null); return; } const val = Number(normalizedText); if (!Number.isFinite(val)) { setWeightDraft(set.weight !== null ? String(set.weight) : ""); return; } setWeightDraft(String(val)); updateSet(exerciseId, set.id, "weight", val); }, [exerciseId, set.id, set.weight, updateSet, weightDraft]);
  const handleRepsChange = useCallback((text: string) => { const val = text === "" ? null : parseInt(text, 10); if (val !== null && isNaN(val)) return; updateSet(exerciseId, set.id, "reps", val); }, [exerciseId, set.id, updateSet]);
  const handleDurationChange = useCallback((text: string) => { const val = text === "" ? null : parseInt(text, 10); if (val !== null && isNaN(val)) return; updateSet(exerciseId, set.id, "durationSeconds", val); }, [exerciseId, set.id, updateSet]);
  const handleDistanceChange = useCallback((text: string) => { const normalizedText = text.replace(",", "."); setDistanceDraft(normalizedText); if (normalizedText === "") { updateSet(exerciseId, set.id, "distance", null); return; } if (normalizedText === ".") return; const val = Number(normalizedText); if (!Number.isFinite(val)) return; updateSet(exerciseId, set.id, "distance", val); }, [exerciseId, set.id, updateSet]);
  const handleDistanceBlur = useCallback(() => { setIsDistanceFocused(false); const normalizedText = distanceDraft.trim().replace(",", "."); if (normalizedText === "") { setDistanceDraft(""); updateSet(exerciseId, set.id, "distance", null); return; } const val = Number(normalizedText); if (!Number.isFinite(val)) { setDistanceDraft(set.distance !== null && set.distance !== undefined ? String(set.distance) : ""); return; } setDistanceDraft(String(val)); updateSet(exerciseId, set.id, "distance", val); }, [distanceDraft, exerciseId, set.distance, set.id, updateSet]);
  const handleToggleComplete = useCallback(() => { if (!isCompleted) { Keyboard.dismiss(); if (trackingMode === "strength") { const resolved = resolveSetOnComplete(set, placeholder); if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight); if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps); } else if (trackingMode === "timed") { if (set.durationSeconds == null) updateSet(exerciseId, set.id, "durationSeconds", 0); } else { if (set.durationSeconds == null) updateSet(exerciseId, set.id, "durationSeconds", 0); if (set.distance == null) updateSet(exerciseId, set.id, "distance", 0); } HapticFeedback.medium(); } else { HapticFeedback.light(); } LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); toggleSetCompletion(exerciseId, set.id); if (!isCompleted && restSeconds > 0) { startRestTimer(exerciseId, restSeconds, toTitleCase(exerciseName)); } }, [exerciseId, exerciseName, isCompleted, placeholder, restSeconds, set, startRestTimer, toggleSetCompletion, trackingMode, updateSet]);
  const handleToggleType = useCallback(() => { HapticFeedback.selection(); toggleSetType(exerciseId, set.id); }, [exerciseId, set.id, toggleSetType]);
  const handleLongPress = useCallback(() => { HapticFeedback.selection(); setShowLegend(true); }, []);
  const handlePressOut = useCallback(() => { setShowLegend(false); }, []);
  const handleRemove = useCallback(() => { removeSet(exerciseId, set.id); }, [exerciseId, set.id, removeSet]);
  const setNumberColor = useMemo(() => { const type = set.type || "working"; if (type === "warmup") return COLORS.ACCENT_YELLOW; if (type === "dropset") return COLORS.ACCENT_GREEN; return COLORS.ACCENT_BLUE; }, [set.type]);
  const renderInputs = () => { if (trackingMode === "timed") { return (<InputBlock value={set.durationSeconds !== null && set.durationSeconds !== undefined ? String(set.durationSeconds) : ""} placeholder="0" keyboardType="number-pad" onChangeText={handleDurationChange} completed={isCompleted} style={{ flex: 2 }} />); } if (trackingMode === "cardio") { return (<><InputBlock value={set.durationSeconds !== null && set.durationSeconds !== undefined ? String(set.durationSeconds) : ""} placeholder="0" keyboardType="number-pad" onChangeText={handleDurationChange} completed={isCompleted} /><InputBlock value={distanceDraft} placeholder="0.00" keyboardType={decimalKeyboardType} onChangeText={handleDistanceChange} onFocus={() => setIsDistanceFocused(true)} onBlur={handleDistanceBlur} completed={isCompleted} /></>); } return (<><InputBlock value={weightDraft} placeholder={placeholder.weight !== null ? String(placeholder.weight) : "-"} keyboardType={decimalKeyboardType} onChangeText={handleWeightChange} onFocus={() => setIsWeightFocused(true)} onBlur={handleWeightBlur} completed={isCompleted} /><InputBlock value={set.reps !== null ? String(set.reps) : ""} placeholder={placeholder.reps !== null ? String(placeholder.reps) : "-"} keyboardType="number-pad" onChangeText={handleRepsChange} completed={isCompleted} /></>); };
  return (
    <View style={[styles.row, isCompleted && styles.rowCompleted]}>
      <Pressable style={styles.indexCell} onPress={handleToggleType} onLongPress={handleLongPress} onPressOut={handlePressOut} delayLongPress={300} hitSlop={8}><Text style={[styles.indexText, { color: setNumberColor }]}>{index + 1}</Text></Pressable>
      {showLegend && (<View style={styles.legendPopup}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_YELLOW }]} /><Text style={styles.legendText}>WARMUP</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_BLUE }]} /><Text style={styles.legendText}>WORKING</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.ACCENT_GREEN }]} /><Text style={styles.legendText}>DROPSET</Text></View></View>)}
      <View style={styles.inputsWrapper}>{renderInputs()}</View>
      <View style={styles.actionCell}><Pressable onPress={handleToggleComplete} style={({ pressed }) => [styles.checkButton, isCompleted && styles.checkButtonCompleted, pressed && styles.actionPressed]}>{isCompleted ? (<Check size={14} color={COLORS.ACCENT_GREEN} strokeWidth={3} />) : (<View style={styles.checkPlaceholder} />)}</Pressable>{!isCompleted ? (<Pressable onPress={handleRemove} hitSlop={10} style={styles.removeButton}><X size={12} color={COLORS.DANGER} /></Pressable>) : null}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, backgroundColor: COLORS.BG, paddingHorizontal: 4 },
  rowCompleted: { backgroundColor: COLORS.ACCENT_GREEN_DEEP, borderRadius: UI.RADIUS_ITEM },
  indexCell: { width: 32, alignItems: "center", justifyContent: "center" },
  indexText: { color: COLORS.TEXT_TERTIARY, fontSize: 13, fontFamily: FONT_FAMILIES.MONO, fontWeight: "800" },
  inputsWrapper: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 12 },
  inputCell: { width: 72, height: 32, backgroundColor: "rgba(255, 255, 255, 0.03)", borderRadius: 6, borderWidth: 1, borderColor: COLORS.BORDER, justifyContent: "center" },
  inputText: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700", textAlign: "center", padding: 0 },
  inputTextCompleted: { color: COLORS.ACCENT_GREEN },
  actionCell: { width: 60, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingRight: 4 },
  checkButton: { width: 28, height: 28, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, alignItems: "center", justifyContent: "center" },
  checkButtonCompleted: { borderColor: COLORS.ACCENT_GREEN, backgroundColor: "transparent" },
  checkPlaceholder: { width: 14, height: 14 },
  removeButton: { padding: 4 },
  actionPressed: { opacity: 0.7 },
  legendPopup: { position: "absolute", left: 40, top: -40, backgroundColor: "rgba(18, 18, 18, 0.95)", padding: 10, borderRadius: UI.RADIUS_ITEM, borderWidth: 1, borderColor: COLORS.BORDER, zIndex: 1000, gap: 6, flexDirection: "row", alignItems: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.TEXT_PRIMARY, fontSize: 9, fontFamily: FONT_FAMILIES.MONO, fontWeight: "900" },
});

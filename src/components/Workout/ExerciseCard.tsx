import React, { useState, useCallback, useMemo, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation, ScrollView, Dimensions } from "react-native";
import { Trash2, Clock, StickyNote, Dumbbell, Plus, Check, User, Activity, Timer } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import type { WorkoutExercise } from "@/types";
import { resolveExercisePlaceholders } from "@/utils/placeholders";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "@/components/RestTimerPicker";
import { showConfirm } from "@/utils/alerts";
import { HapticFeedback } from "@/utils/haptics";
import { SetRow } from "./SetRow";
import ExercisePickerField from "@/components/ExercisePickerField";
import type { ExerciseDefinition, ExerciseTrackingMode } from "@/types";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { getTrackingModeLabel } from "@/utils/exerciseTracking";
import ExerciseTrackingModeSelector from "@/components/ExerciseTrackingModeSelector";
import MuscleSelector from "@/components/MuscleSelector";
import { MuscleGroup, MUSCLE_LABELS } from "@/constants/muscles";
import ExerciseHistoryGraph from "./ExerciseHistoryGraph";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ExerciseCardProps { exercise: WorkoutExercise; }

export const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({ exercise }) {
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [musclePickerVisible, setMusclePickerVisible] = useState(false);
  const [trackingPickerVisible, setTrackingPickerVisible] = useState(false);
  const [trackingAnchor, setTrackingAnchor] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const [restPickerVisible, setRestPickerVisible] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<"SETS" | "HISTORY">("SETS");
  const pagerRef = useRef<ScrollView>(null);
  const trackingSegmentRef = useRef<View>(null);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const toggleExerciseUnit = useWorkoutSessionStore((s) => s.toggleExerciseUnit);
  const toggleExerciseBodyweight = useWorkoutSessionStore((s) => s.toggleExerciseBodyweight);
  const selectExerciseDefinition = useWorkoutSessionStore((s) => s.selectExerciseDefinition);
  const history = useWorkoutSessionStore((s) => s.history);
  const handleRestSave = useCallback((seconds: number) => { updateExerciseField(exercise.id, "restSeconds", seconds); }, [exercise.id, updateExerciseField]);
  const handleExerciseSelect = useCallback((selectedExercise: ExerciseDefinition) => { selectExerciseDefinition(exercise.id, selectedExercise); }, [exercise.id, selectExerciseDefinition]);
  const handleNotesChange = useCallback((text: string) => { updateExerciseField(exercise.id, "notes", text); }, [exercise.id, updateExerciseField]);
  const handleTrackingModeChange = useCallback((trackingMode: ExerciseTrackingMode) => { updateExerciseField(exercise.id, "trackingMode", trackingMode); }, [exercise.id, updateExerciseField]);
  const handleMusclesChange = useCallback((muscles: MuscleGroup[]) => { updateExerciseField(exercise.id, "muscles", muscles); HapticFeedback.selection(); }, [exercise.id, updateExerciseField]);
  const handleShowTrackingPicker = () => { trackingSegmentRef.current?.measureInWindow((x, y, width, height) => { setTrackingAnchor({ x, y, width, height }); setTrackingPickerVisible(true); }); };
  const placeholders = useMemo(() => exercise.trackingMode === "strength" ? resolveExercisePlaceholders(getExerciseIdentityKey(exercise), exercise.sets, history, exercise.weightUnit || "kg") : [], [exercise, history]);
  const handleAddSet = useCallback(() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); addSet(exercise.id); }, [exercise.id, addSet]);
  const handleRemoveExercise = useCallback(() => { showConfirm("Remove Exercise", `Remove "${exercise.name}"?`, () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); removeExercise(exercise.id); }); }, [exercise.id, exercise.name, removeExercise]);
  const handleUnitToggle = useCallback(() => { HapticFeedback.selection(); toggleExerciseUnit(exercise.id); }, [exercise.id, toggleExerciseUnit]);
  const handleBodyweightToggle = useCallback(() => { HapticFeedback.selection(); toggleExerciseBodyweight(exercise.id); }, [exercise.id, toggleExerciseBodyweight]);
  const hasNotes = (exercise.notes || "").trim().length > 0;
  const TrackingIcon = exercise.trackingMode === 'strength' ? Dumbbell : exercise.trackingMode === 'timed' ? Timer : Activity;
  const handleTabPress = (tab: "SETS" | "HISTORY") => { setActiveTab(tab); pagerRef.current?.scrollTo({ x: tab === "SETS" ? 0 : SCREEN_WIDTH, animated: true }); };
  const handleScroll = (event: any) => { const x = event.nativeEvent.contentOffset.x; const newTab = x < SCREEN_WIDTH / 2 ? "SETS" : "HISTORY"; if (newTab !== activeTab) { setActiveTab(newTab); } };
  return (
    <View style={styles.card}>
      <View style={styles.topRow}><View style={styles.topContent}><Pressable onPress={() => setExercisePickerVisible(true)}><Text style={styles.exerciseNameText}>{exercise.name}</Text></Pressable><Pressable onPress={() => setMusclePickerVisible(true)}><Text style={styles.muscleText} numberOfLines={1}>{(exercise.muscles && exercise.muscles.length > 0 ? exercise.muscles.map(m => MUSCLE_LABELS[m as MuscleGroup] || m).join(" • ") : "General").toUpperCase()}</Text></Pressable></View><Pressable onPress={handleRemoveExercise} hitSlop={12} style={styles.cardRemoveBtn}><Trash2 size={16} color={COLORS.DANGER} /></Pressable></View>
      <ExercisePickerField visible={exercisePickerVisible} onClose={() => setExercisePickerVisible(false)} onSelect={handleExerciseSelect} selectedDefinitionId={exercise.exerciseDefinitionId} />
      <MuscleSelector selectedMuscles={exercise.muscles || []} onSelect={handleMusclesChange} visible={musclePickerVisible} onClose={() => setMusclePickerVisible(false)} />
      <View style={styles.instrumentBar}><View ref={trackingSegmentRef} style={{ flex: 1 }} collapsable={false}><Pressable style={styles.instrumentSegment} onPress={handleShowTrackingPicker}><TrackingIcon size={12} color={COLORS.ACCENT_BLUE} /><Text style={styles.instrumentText}>{getTrackingModeLabel(exercise.trackingMode).toUpperCase()}</Text></Pressable></View><View style={styles.instrumentDivider} />{exercise.trackingMode === "strength" && (<><Pressable style={styles.instrumentSegment} onPress={handleBodyweightToggle}>{exercise.isBodyweight ? (<User size={12} color={COLORS.ACCENT_GREEN} />) : (<Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />)}<Text style={[styles.instrumentText, exercise.isBodyweight && { color: COLORS.ACCENT_GREEN }]}>{exercise.isBodyweight ? "BODYWEIGHT" : "WEIGHTED"}</Text></Pressable>{!exercise.isBodyweight && (<><View style={styles.instrumentDivider} /><Pressable style={styles.instrumentSegment} onPress={handleUnitToggle}><Text style={[styles.instrumentText, { color: COLORS.ACCENT_BLUE }]}>{(exercise.weightUnit || "kg").toUpperCase()}</Text></Pressable></>)}<View style={styles.instrumentDivider} /></>)}<Pressable style={styles.instrumentSegment} onPress={() => setRestPickerVisible(true)}><Clock size={12} color={COLORS.TEXT_TERTIARY} /><Text style={styles.instrumentText}>{formatSecondsToMMSS(exercise.restSeconds)}</Text></Pressable></View>
      <View style={styles.tabRow}><Pressable onPress={() => handleTabPress("SETS")} style={[styles.tabItem, activeTab === "SETS" && styles.activeTab]}><Text style={[styles.tabText, activeTab === "SETS" && styles.activeTabText]}>SETS</Text></Pressable><Pressable onPress={() => handleTabPress("HISTORY")} style={[styles.tabItem, activeTab === "HISTORY" && styles.activeTab]}><Text style={[styles.tabText, activeTab === "HISTORY" && styles.activeTabText]}>HISTORY</Text></Pressable></View>
      <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} scrollEnabled={!isEditingNotes} style={styles.pager}>
        <View style={styles.pagerPage}><Pressable onPress={() => setIsEditingNotes(true)} style={({ pressed }) => [styles.notesContainer, pressed && !isEditingNotes && { opacity: 0.85 }]}><StickyNote size={12} color={COLORS.TEXT_TERTIARY} style={{ marginTop: isEditingNotes ? 3 : 1 }} />{isEditingNotes ? (<TextInput style={styles.notesInput} value={exercise.notes} onChangeText={handleNotesChange} onBlur={() => setIsEditingNotes(false)} placeholder="Add cues, pace targets, machine settings..." placeholderTextColor={COLORS.TEXT_TERTIARY} autoFocus multiline />) : (<Text style={[styles.notesText, !hasNotes && styles.notesPlaceholder, !hasNotes && styles.notesTextCompact]}>{hasNotes ? exercise.notes : "Add notes"}</Text>)}</Pressable><View style={styles.setsShell}><View style={styles.tableHeader}><View style={styles.headerCellIndex}><Text style={styles.headerText}>#</Text></View><View style={styles.headerInputsWrapper}><View style={styles.headerCellInput}><Text style={styles.headerText}>{exercise.trackingMode === 'strength' ? 'WEIGHT' : 'TIME'}</Text></View><View style={styles.headerCellInput}><Text style={styles.headerText}>{exercise.trackingMode === 'strength' ? 'REPS' : 'DIST'}</Text></View></View><View style={styles.headerCellAction}><Check size={12} color={COLORS.ACCENT_GREEN} /></View></View><View style={styles.rowsWrap}>{exercise.sets.map((s, i) => (<SetRow key={s.id} set={s} index={i} placeholder={placeholders[i] ?? { weight: null, reps: null }} exerciseId={exercise.id} exerciseName={exercise.name} restSeconds={exercise.restSeconds} trackingMode={exercise.trackingMode} weightUnit={exercise.weightUnit || "kg"} />))}</View><Pressable onPress={handleAddSet} style={({ pressed }) => [styles.addSetBtn, pressed && { backgroundColor: "rgba(255, 255, 255, 0.05)" }]}><Plus size={15} color={COLORS.TEXT_SECONDARY} strokeWidth={2} /><Text style={styles.addSetBtnText}>ADD SET</Text></Pressable></View></View>
        <View style={styles.pagerPage}><ExerciseHistoryGraph exerciseKey={getExerciseIdentityKey(exercise)} /></View>
      </ScrollView>
      <RestTimerPicker visible={restPickerVisible} initialSeconds={exercise.restSeconds} onClose={() => setRestPickerVisible(false)} onSave={handleRestSave} /><ExerciseTrackingModeSelector value={exercise.trackingMode} onChange={handleTrackingModeChange} visible={trackingPickerVisible} onClose={() => setTrackingPickerVisible(false)} anchorLayout={trackingAnchor} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingTop: 16, paddingHorizontal: 16, backgroundColor: COLORS.BG },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16 },
  topContent: { flex: 1 },
  exerciseNameText: { fontSize: 24, fontWeight: "900", color: COLORS.TEXT_PRIMARY, fontFamily: FONT_FAMILIES.MEDIUM },
  muscleText: { color: "#FF4500", fontSize: 13, fontWeight: "800", marginTop: 4, fontFamily: FONT_FAMILIES.MONO },
  cardRemoveBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  instrumentBar: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderRadius: 8, borderWidth: 1, borderColor: COLORS.BORDER, height: 36, marginBottom: 20, overflow: 'hidden' },
  instrumentSegment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: '100%', paddingHorizontal: 8 },
  instrumentDivider: { width: 1, height: '60%', backgroundColor: COLORS.BORDER },
  instrumentText: { color: COLORS.TEXT_SECONDARY, fontSize: 10, fontWeight: "800", fontFamily: FONT_FAMILIES.MONO },
  tabRow: { flexDirection: "row", gap: 16, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  tabItem: { paddingBottom: 8 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.ACCENT_BLUE },
  tabText: { color: COLORS.TEXT_TERTIARY, fontSize: 13, fontWeight: "800", fontFamily: FONT_FAMILIES.MEDIUM },
  activeTabText: { color: COLORS.ACCENT_BLUE },
  pager: { flex: 1 },
  pagerPage: { width: SCREEN_WIDTH - 32 },
  notesContainer: { flexDirection: "row", gap: 10, backgroundColor: "transparent", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginTop: 0, marginBottom: 12, borderWidth: 1, borderColor: COLORS.BORDER },
  notesText: { color: COLORS.TEXT_SECONDARY, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILIES.MEDIUM, flex: 1 },
  notesTextCompact: { fontSize: 12 },
  notesPlaceholder: { color: COLORS.TEXT_TERTIARY },
  notesInput: { flex: 1, color: COLORS.TEXT_SECONDARY, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILIES.MEDIUM, padding: 0, textAlignVertical: "top" },
  setsShell: { marginTop: 0, backgroundColor: "transparent", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  tableHeader: { flexDirection: "row", paddingHorizontal: 4, marginBottom: 8 },
  headerText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", fontFamily: FONT_FAMILIES.MONO },
  headerCellIndex: { width: 32, alignItems: "center" },
  headerInputsWrapper: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 12 },
  headerCellInput: { width: 72, alignItems: "center" },
  headerCellAction: { width: 60, alignItems: "flex-end", paddingRight: 10 },
  rowsWrap: { gap: 2 },
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, height: 40, borderRadius: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  addSetBtnText: { color: COLORS.TEXT_SECONDARY, fontWeight: "800", fontSize: 11, fontFamily: FONT_FAMILIES.MONO },
});

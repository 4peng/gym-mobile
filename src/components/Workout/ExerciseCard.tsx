import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Activity,
  Check,
  Clock,
  Dumbbell,
  Plus,
  StickyNote,
  Timer,
  Trash2,
  User,
} from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, LAYOUT, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import type { ExerciseDefinition, ExerciseTrackingMode, WorkoutExercise } from "@/types";
import { resolveExercisePlaceholders, type SetPlaceholder } from "@/utils/placeholders";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "@/components/RestTimerPicker";
import { showConfirm } from "@/utils/alerts";
import { HapticFeedback } from "@/utils/haptics";
import { SetRow, SET_ROW_LAYOUT } from "./SetRow";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { getTrackingModeLabel } from "@/utils/exerciseTracking";
import ExerciseTrackingModeSelector from "@/components/ExerciseTrackingModeSelector";
import { formatMuscleLabels } from "@/constants/muscles";
import ExerciseHistoryGraph from "./ExerciseHistoryGraph";

const PAGE_WIDTH = LAYOUT.screenWidth - LAYOUT.gutter * 2;
const TRACKING_ICON = { strength: Dumbbell, timed: Timer, cardio: Activity } as const;

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  onMusclePickerOpen: (exerciseId: string) => void;
}

/** One exercise of the live session: header, instrument bar, then SETS / HISTORY pager. */
export const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({
  exercise,
  onMusclePickerOpen,
}) {
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [trackingPickerVisible, setTrackingPickerVisible] = useState(false);
  const [trackingAnchor, setTrackingAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
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

  const identityKey = getExerciseIdentityKey(exercise);
  const previous = useDbQuery(() => workoutRepo.latestExercise(identityKey), [identityKey]);

  // Positional identity is kept stable so unaffected SetRows (React.memo) skip re-rendering.
  const lastPlaceholdersRef = useRef<SetPlaceholder[]>([]);
  const placeholders = useMemo(() => {
    const next =
      exercise.trackingMode === "strength"
        ? resolveExercisePlaceholders(exercise.sets, previous, exercise.weightUnit || "kg")
        : [];
    const prev = lastPlaceholdersRef.current;
    const stable = next.map((p, i) =>
      prev[i] && prev[i].weight === p.weight && prev[i].reps === p.reps ? prev[i] : p,
    );
    lastPlaceholdersRef.current = stable;
    return stable;
  }, [exercise.sets, exercise.trackingMode, exercise.weightUnit, previous]);

  const handleExerciseSelect = useCallback(
    (def: ExerciseDefinition) => selectExerciseDefinition(exercise.id, def),
    [exercise.id, selectExerciseDefinition],
  );
  const handleTrackingModeChange = useCallback(
    (mode: ExerciseTrackingMode) => updateExerciseField(exercise.id, "trackingMode", mode),
    [exercise.id, updateExerciseField],
  );
  const handleShowTrackingPicker = () =>
    trackingSegmentRef.current?.measureInWindow((x, y, width, height) => {
      setTrackingAnchor({ x, y, width, height });
      setTrackingPickerVisible(true);
    });
  const handleAddSet = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addSet(exercise.id);
  };
  const handleRemoveExercise = () =>
    showConfirm("Remove Exercise", `Remove "${exercise.name}"?`, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeExercise(exercise.id);
    });
  const handleTabPress = (tab: "SETS" | "HISTORY") => {
    setActiveTab(tab);
    pagerRef.current?.scrollTo({ x: tab === "SETS" ? 0 : PAGE_WIDTH, animated: true });
  };

  const hasNotes = (exercise.notes || "").trim().length > 0;
  const TrackingIcon = TRACKING_ICON[exercise.trackingMode];
  const isStrength = exercise.trackingMode === "strength";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.topContent}>
          <Pressable onPress={() => setExercisePickerVisible(true)}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
          </Pressable>
          <Pressable onPress={() => onMusclePickerOpen(exercise.id)}>
            <Text style={styles.muscleText} numberOfLines={1}>
              {formatMuscleLabels(exercise.muscles).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleRemoveExercise} hitSlop={12} style={styles.removeBtn}>
          <Trash2 size={16} color={COLORS.DANGER} />
        </Pressable>
      </View>

      <View style={styles.instrumentBar}>
        <View ref={trackingSegmentRef} style={styles.segmentWrap} collapsable={false}>
          <Pressable style={styles.segment} onPress={handleShowTrackingPicker}>
            <TrackingIcon size={12} color={COLORS.ACCENT_BLUE} />
            <Text style={styles.segmentText}>
              {getTrackingModeLabel(exercise.trackingMode).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        {isStrength ? (
          <>
            <View style={styles.divider} />
            <Pressable
              style={styles.segment}
              onPress={() => {
                HapticFeedback.selection();
                toggleExerciseBodyweight(exercise.id);
              }}
            >
              {exercise.isBodyweight ? (
                <User size={12} color={COLORS.ACCENT_GREEN} />
              ) : (
                <Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />
              )}
              <Text
                style={[
                  styles.segmentText,
                  exercise.isBodyweight && { color: COLORS.ACCENT_GREEN },
                ]}
              >
                {exercise.isBodyweight ? "BODYWEIGHT" : "WEIGHTED"}
              </Text>
            </Pressable>
            {!exercise.isBodyweight ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={styles.segment}
                  onPress={() => {
                    HapticFeedback.selection();
                    toggleExerciseUnit(exercise.id);
                  }}
                >
                  <Text style={[styles.segmentText, { color: COLORS.ACCENT_BLUE }]}>
                    {(exercise.weightUnit || "kg").toUpperCase()}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
        <View style={styles.divider} />
        <Pressable style={styles.segment} onPress={() => setRestPickerVisible(true)}>
          <Clock size={12} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.segmentText}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {(["SETS", "HISTORY"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => handleTabPress(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: COLORS.ACCENT_BLUE }]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) =>
          setActiveTab(e.nativeEvent.contentOffset.x < PAGE_WIDTH / 2 ? "SETS" : "HISTORY")
        }
        scrollEventThrottle={16}
        scrollEnabled={!isEditingNotes}
      >
        <View style={styles.page}>
          <Pressable
            onPress={() => setIsEditingNotes(true)}
            style={({ pressed }) => [styles.notes, pressed && !isEditingNotes && UI.pressed]}
          >
            <StickyNote size={12} color={COLORS.TEXT_TERTIARY} style={{ marginTop: 2 }} />
            {isEditingNotes ? (
              <TextInput
                style={styles.notesInput}
                value={exercise.notes}
                onChangeText={(text) => updateExerciseField(exercise.id, "notes", text)}
                onBlur={() => setIsEditingNotes(false)}
                placeholder="Add cues, pace targets, machine settings..."
                placeholderTextColor={COLORS.TEXT_TERTIARY}
                autoFocus
                multiline
              />
            ) : (
              <Text style={[styles.notesText, !hasNotes && { color: COLORS.TEXT_TERTIARY }]}>
                {hasNotes ? exercise.notes : "Add notes"}
              </Text>
            )}
          </Pressable>

          <View style={styles.setsShell}>
            <View style={styles.tableHeader}>
              <View style={{ width: SET_ROW_LAYOUT.indexWidth, alignItems: "center" }}>
                <Text style={styles.headerText}>#</Text>
              </View>
              <View style={styles.headerInputs}>
                <View style={styles.headerCell}>
                  <Text style={styles.headerText}>{isStrength ? "WEIGHT" : "TIME"}</Text>
                </View>
                {exercise.trackingMode !== "timed" ? (
                  <View style={styles.headerCell}>
                    <Text style={styles.headerText}>{isStrength ? "REPS" : "DIST"}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.headerActions}>
                <Check size={12} color={COLORS.ACCENT_GREEN} />
              </View>
            </View>
            <View style={styles.rows}>
              {exercise.sets.map((s, i) => (
                <SetRow
                  key={s.id}
                  set={s}
                  index={i}
                  placeholder={placeholders[i] ?? { weight: null, reps: null }}
                  exerciseId={exercise.id}
                  exerciseName={exercise.name}
                  restSeconds={exercise.restSeconds}
                  trackingMode={exercise.trackingMode}
                />
              ))}
            </View>
            <Pressable
              onPress={handleAddSet}
              style={({ pressed }) => [styles.addSet, pressed && UI.pressed]}
            >
              <Plus size={15} color={COLORS.TEXT_SECONDARY} strokeWidth={2} />
              <Text style={styles.addSetText}>ADD SET</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.page}>
          <ExerciseHistoryGraph exerciseKey={identityKey} />
        </View>
      </ScrollView>

      <ExercisePickerModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelect={handleExerciseSelect}
        selectedDefinitionId={exercise.exerciseDefinitionId}
      />
      <RestTimerPicker
        visible={restPickerVisible}
        initialSeconds={exercise.restSeconds}
        onClose={() => setRestPickerVisible(false)}
        onSave={(seconds) => updateExerciseField(exercise.id, "restSeconds", seconds)}
      />
      <ExerciseTrackingModeSelector
        value={exercise.trackingMode}
        onChange={handleTrackingModeChange}
        visible={trackingPickerVisible}
        onClose={() => setTrackingPickerVisible(false)}
        anchorLayout={trackingAnchor}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingTop: SPACE.lg, paddingHorizontal: LAYOUT.gutter },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.sm + 2,
    marginBottom: SPACE.lg,
  },
  topContent: { flex: 1 },
  exerciseName: { ...TYPE.title, fontSize: 24 },
  muscleText: { ...TYPE.monoSmall, color: COLORS.ORANGE, fontSize: 13, marginTop: SPACE.xs },
  removeBtn: {
    width: LAYOUT.buttonSm,
    height: LAYOUT.buttonSm,
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    height: 36,
    marginBottom: SPACE.xl,
    overflow: "hidden",
  },
  segmentWrap: { flex: 1 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm - 2,
    height: "100%",
    paddingHorizontal: SPACE.sm,
  },
  segmentText: { ...TYPE.label, letterSpacing: 0, color: COLORS.TEXT_SECONDARY },
  divider: { width: 1, height: "60%", backgroundColor: COLORS.BORDER },
  tabRow: {
    flexDirection: "row",
    gap: SPACE.lg,
    marginBottom: SPACE.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tab: { paddingBottom: SPACE.sm },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.ACCENT_BLUE },
  tabText: { ...TYPE.bodyMuted, color: COLORS.TEXT_TERTIARY, lineHeight: undefined },
  page: { width: PAGE_WIDTH },
  notes: {
    flexDirection: "row",
    gap: SPACE.sm + 2,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    borderRadius: RADIUS.item,
    marginBottom: SPACE.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  notesText: { ...TYPE.bodyMuted, flex: 1 },
  notesInput: { ...TYPE.bodyMuted, flex: 1, padding: 0, textAlignVertical: "top" },
  setsShell: {
    borderRadius: RADIUS.item,
    padding: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  tableHeader: { flexDirection: "row", paddingHorizontal: SPACE.xs, marginBottom: SPACE.sm },
  headerText: { ...TYPE.label, letterSpacing: 0, color: COLORS.TEXT_PRIMARY },
  headerInputs: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: SET_ROW_LAYOUT.gap,
  },
  headerCell: { width: SET_ROW_LAYOUT.inputWidth, alignItems: "center" },
  headerActions: {
    width: SET_ROW_LAYOUT.actionsWidth,
    alignItems: "flex-end",
    paddingRight: SPACE.sm + 2,
  },
  rows: { gap: 2 },
  addSet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
    height: 40,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: SURFACE.raised,
  },
  addSetText: { ...TYPE.label, letterSpacing: 0, color: COLORS.TEXT_SECONDARY },
});

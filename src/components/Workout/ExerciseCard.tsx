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
import { COLORS, LAYOUT, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import type { WorkoutExercise } from "@/types";
import { resolveExercisePlaceholders, type SetPlaceholder } from "@/utils/placeholders";
import { formatSecondsToMMSS } from "@/utils/conversions";
import { showConfirm } from "@/utils/alerts";
import { HapticFeedback } from "@/utils/haptics";
import { SetRow, SET_ROW_LAYOUT } from "./SetRow";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { getTrackingModeLabel } from "@/utils/exerciseTracking";
import { formatMuscleLabels } from "@/constants/muscles";
import ExerciseHistoryGraph from "./ExerciseHistoryGraph";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const CARD_PAD = SPACE.lg;
/** Inner width of the card: screen minus gutters, padding and the 1px borders. */
const PAGE_WIDTH = LAYOUT.screenWidth - LAYOUT.gutter * 2 - CARD_PAD * 2 - 2;
const TRACKING_ICON = { strength: Dumbbell, timed: Timer, cardio: Activity } as const;
const TABS = [
  { value: "SETS", label: "SETS" },
  { value: "HISTORY", label: "HISTORY" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const segmentStyle = ({ pressed }: { pressed: boolean }) => [styles.segment, pressed && UI.pressed];

export type ExerciseCardPicker = "exercise" | "muscles" | "rest" | "tracking";
export interface AnchorLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  /**
   * Every picker is rendered by the screen, not the card: an overlay mounted inside a
   * scrolling card is positioned relative to that card and gets clipped.
   */
  onOpenPicker: (picker: ExerciseCardPicker, exerciseId: string, anchor?: AnchorLayout) => void;
}

/** One exercise of the live session: header, instrument bar, then SETS / HISTORY pager. */
export const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({
  exercise,
  onOpenPicker,
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("SETS");
  // The history chart runs a query and draws an SVG, so it mounts on first visit only.
  const [historyVisited, setHistoryVisited] = useState(false);
  const pagerRef = useRef<ScrollView>(null);
  const trackingSegmentRef = useRef<View>(null);

  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const toggleExerciseUnit = useWorkoutSessionStore((s) => s.toggleExerciseUnit);
  const toggleExerciseBodyweight = useWorkoutSessionStore((s) => s.toggleExerciseBodyweight);

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

  const openTrackingPicker = () =>
    trackingSegmentRef.current?.measureInWindow((x, y, width, height) =>
      onOpenPicker("tracking", exercise.id, { x, y, width, height }),
    );
  const handleAddSet = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addSet(exercise.id);
  };
  const handleRemoveExercise = () =>
    showConfirm("Remove exercise", `Remove "${exercise.name}"?`, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeExercise(exercise.id);
    });
  const showTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "HISTORY") setHistoryVisited(true);
  }, []);
  const handleTabPress = (tab: Tab) => {
    showTab(tab);
    pagerRef.current?.scrollTo({ x: tab === "SETS" ? 0 : PAGE_WIDTH, animated: true });
  };

  const hasNotes = (exercise.notes || "").trim().length > 0;
  const TrackingIcon = TRACKING_ICON[exercise.trackingMode];
  const isStrength = exercise.trackingMode === "strength";

  return (
    <View style={[UI.card, styles.card]}>
      <View style={styles.topRow}>
        <View style={styles.topContent}>
          <Pressable
            onPress={() => onOpenPicker("exercise", exercise.id)}
            style={({ pressed }) => pressed && UI.pressed}
          >
            <Text style={TYPE.titleSm}>{exercise.name || "Select exercise"}</Text>
          </Pressable>
          <Pressable
            onPress={() => onOpenPicker("muscles", exercise.id)}
            style={({ pressed }) => pressed && UI.pressed}
          >
            <Text style={styles.muscleText} numberOfLines={1}>
              {formatMuscleLabels(exercise.muscles).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        <IconButton size="sm" ghost tone="danger" onPress={handleRemoveExercise}>
          <Trash2 size={16} color={COLORS.DANGER} />
        </IconButton>
      </View>

      <View style={[UI.inset, styles.instrumentBar]}>
        <View ref={trackingSegmentRef} style={styles.segmentWrap} collapsable={false}>
          <Pressable style={segmentStyle} onPress={openTrackingPicker}>
            <TrackingIcon size={12} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.segmentText}>
              {getTrackingModeLabel(exercise.trackingMode).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        {isStrength ? (
          <>
            <View style={styles.divider} />
            <Pressable
              style={segmentStyle}
              onPress={() => {
                HapticFeedback.selection();
                toggleExerciseBodyweight(exercise.id);
              }}
            >
              {exercise.isBodyweight ? (
                <User size={12} color={COLORS.TEXT_SECONDARY} />
              ) : (
                <Dumbbell size={12} color={COLORS.TEXT_SECONDARY} />
              )}
              <Text style={styles.segmentText}>
                {exercise.isBodyweight ? "BODYWEIGHT" : "WEIGHTED"}
              </Text>
            </Pressable>
            {!exercise.isBodyweight ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={segmentStyle}
                  onPress={() => {
                    HapticFeedback.selection();
                    toggleExerciseUnit(exercise.id);
                  }}
                >
                  <Text style={styles.segmentText}>
                    {(exercise.weightUnit || "kg").toUpperCase()}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
        <View style={styles.divider} />
        <Pressable style={segmentStyle} onPress={() => onOpenPicker("rest", exercise.id)}>
          <Clock size={12} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.segmentText}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <SegmentedControl compact options={TABS} value={activeTab} onChange={handleTabPress} />
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) =>
          showTab(e.nativeEvent.contentOffset.x < PAGE_WIDTH / 2 ? "SETS" : "HISTORY")
        }
        scrollEventThrottle={16}
        scrollEnabled={!isEditingNotes}
      >
        <View style={styles.page}>
          <Pressable
            onPress={() => setIsEditingNotes(true)}
            style={({ pressed }) => [
              UI.inset,
              styles.notes,
              pressed && !isEditingNotes && UI.pressed,
            ]}
          >
            <StickyNote size={12} color={COLORS.TEXT_TERTIARY} style={styles.notesIcon} />
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
              <Text
                style={[
                  TYPE.bodyMuted,
                  styles.notesText,
                  !hasNotes && { color: COLORS.TEXT_TERTIARY },
                ]}
              >
                {hasNotes ? exercise.notes : "Add notes"}
              </Text>
            )}
          </Pressable>

          <View style={styles.tableHeader}>
            <View style={styles.headerIndex}>
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
              <Check size={12} color={COLORS.TEXT_TERTIARY} />
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
          <Button
            label="Add set"
            size="md"
            onPress={handleAddSet}
            icon={<Plus size={16} color={buttonForeground()} />}
            style={styles.addSet}
          />
        </View>
        <View style={styles.page}>
          {historyVisited ? (
            <ExerciseHistoryGraph exerciseKey={identityKey} width={PAGE_WIDTH} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { padding: CARD_PAD, marginHorizontal: LAYOUT.gutter, marginBottom: SPACE.md },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  topContent: { flex: 1 },
  muscleText: { ...TYPE.monoSmall, marginTop: SPACE.xs },
  instrumentBar: {
    flexDirection: "row",
    alignItems: "center",
    height: LAYOUT.buttonMd,
    marginBottom: SPACE.lg,
    overflow: "hidden",
  },
  segmentWrap: { flex: 1 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    height: "100%",
    paddingHorizontal: SPACE.sm,
  },
  segmentText: { ...TYPE.label, color: COLORS.TEXT_SECONDARY },
  divider: { width: 1, height: "60%", backgroundColor: SURFACE.hairline },
  tabRow: { marginBottom: SPACE.lg },
  page: { width: PAGE_WIDTH },
  notes: {
    flexDirection: "row",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.md,
  },
  notesIcon: { marginTop: SPACE.xs / 2 },
  notesText: { flex: 1 },
  notesInput: { ...TYPE.bodyMuted, flex: 1, padding: 0, textAlignVertical: "top" },
  tableHeader: { flexDirection: "row", paddingHorizontal: SPACE.xs, marginBottom: SPACE.sm },
  headerIndex: { width: SET_ROW_LAYOUT.indexWidth, alignItems: "center" },
  headerText: { ...TYPE.label, color: COLORS.TEXT_PRIMARY },
  headerInputs: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: SET_ROW_LAYOUT.gap,
  },
  headerCell: { width: SET_ROW_LAYOUT.inputWidth, alignItems: "center" },
  headerActions: {
    width: SET_ROW_LAYOUT.actionsWidth,
    paddingLeft: SPACE.sm + SPACE.xs / 2,
  },
  rows: { gap: SPACE.xs / 2 },
  addSet: { marginTop: SPACE.md },
});

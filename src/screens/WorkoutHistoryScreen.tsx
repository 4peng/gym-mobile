import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, ChevronDown, ChevronUp, Clock, Dumbbell } from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, LAYOUT, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/components/Swipeable";
import { EditableSetTag } from "@/components/Workout/EditableSetTag";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { promptForDate, showConfirm } from "@/utils/alerts";
import { withDatePart } from "@/utils/timestamps";
import { formatDurationMinutes } from "@/utils/activitySummary";
import type { WorkoutSession } from "@/types";

const PAGE = 20;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
const durationLabel = (start: string, end?: string) =>
  end
    ? formatDurationMinutes((new Date(end).getTime() - new Date(start).getTime()) / 60_000)
    : "Unknown";

interface WorkoutSessionCardProps {
  session: WorkoutSession;
  programName?: string;
  onDelete: (id: string) => void;
  onToggleScroll: (enabled: boolean) => void;
}

const WorkoutSessionCard = React.memo(function WorkoutSessionCard({
  session,
  programName,
  onDelete,
  onToggleScroll,
}: WorkoutSessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const updateSessionDate = useWorkoutSessionStore((s) => s.updateSessionDate);
  const completedAt = session.completedAt ?? session.startedAt;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };
  const summary = useMemo(
    () => session.exercises.map((e) => `${e.sets.length} × ${toTitleCase(e.name)}`).join(", "),
    [session.exercises],
  );

  return (
    <Swipeable
      onDelete={() => onDelete(session._id)}
      onToggleScroll={onToggleScroll}
      marginBottom={SPACE.md}
    >
      <View style={[UI.card, styles.card]}>
        <View style={UI.rowBetween}>
          <Pressable
            onPress={() =>
              promptForDate(completedAt, (d) =>
                updateSessionDate(session._id, withDatePart(completedAt, d)),
              )
            }
            style={({ pressed }) => [UI.row, { gap: SPACE.sm - 2 }, pressed && UI.pressed]}
          >
            <Calendar size={14} color={COLORS.ACCENT_BLUE} />
            <Text style={[TYPE.label, { color: COLORS.ACCENT_BLUE }]}>
              {formatDate(completedAt)}
            </Text>
          </Pressable>
          <Pressable onPress={toggle} hitSlop={8}>
            {expanded ? (
              <ChevronUp size={20} color={COLORS.TEXT_TERTIARY} />
            ) : (
              <ChevronDown size={20} color={COLORS.TEXT_TERTIARY} />
            )}
          </Pressable>
        </View>

        <Pressable onPress={toggle}>
          <Text style={TYPE.titleSm}>{programName || "Quick session"}</Text>
          <View style={[UI.row, { gap: SPACE.lg, marginVertical: SPACE.sm }]}>
            <View style={[UI.row, { gap: SPACE.sm - 2 }]}>
              <Clock size={12} color={COLORS.ACCENT_YELLOW} />
              <Text style={TYPE.monoSmall}>
                {durationLabel(session.startedAt, session.completedAt)}
              </Text>
            </View>
            <View style={[UI.row, { gap: SPACE.sm - 2 }]}>
              <Dumbbell size={12} color={COLORS.ACCENT_GREEN} />
              <Text style={TYPE.monoSmall}>{session.exercises.length} exercises</Text>
            </View>
          </View>
          {!expanded && (
            <Text style={TYPE.caption} numberOfLines={1}>
              {summary}
            </Text>
          )}
        </Pressable>

        {expanded && (
          <View style={styles.details}>
            <View style={UI.hairline} />
            {session.notes.trim() ? (
              <View style={[UI.inset, styles.notes]}>
                <Text style={[TYPE.label, { color: COLORS.ACCENT_BLUE }]}>Workout notes</Text>
                <Text style={TYPE.bodyMuted}>{session.notes}</Text>
              </View>
            ) : null}
            {session.exercises.map((ex) => (
              <View key={ex.id} style={{ gap: SPACE.sm }}>
                <Text style={[TYPE.body, { color: COLORS.ACCENT_BLUE }]}>
                  {toTitleCase(ex.name)}
                </Text>
                <View style={styles.sets}>
                  {ex.sets.map((s) => (
                    <EditableSetTag
                      key={s.id}
                      weight={s.weight}
                      reps={s.reps}
                      onSave={(w, r) => {
                        updateHistorySet(session._id, ex.id, s.id, "weight", w);
                        updateHistorySet(session._id, ex.id, s.id, "reps", r);
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Swipeable>
  );
});

/** Paged list of completed sessions, newest first. */
export default function WorkoutHistoryScreen() {
  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const programs = useProgramStore(useShallow((s) => s.programs));
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  const sessions = useDbQuery(() => workoutRepo.list(limit), [limit]);
  const total = useDbQuery(() => workoutRepo.count());
  const programNames = useMemo(() => new Map(programs.map((p) => [p._id, p.name])), [programs]);

  const handleDelete = (id: string) =>
    showConfirm("Delete workout", "Remove this session from your history?", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      deleteHistorySession(id);
    });

  return (
    <KeyboardAvoidingView style={UI.screen} behavior="padding">
      <ScreenHeader title="History" back subtitle={`${total} session${total === 1 ? "" : "s"}`} />
      <FlatList
        data={sessions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
        onEndReached={() => sessions.length < total && setLimit((l) => l + PAGE)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon={<Clock size={48} color={COLORS.BORDER} strokeWidth={1} />}
            title="No history yet"
            subtitle="Complete your first workout to see it here."
          />
        }
        renderItem={({ item }) => (
          <WorkoutSessionCard
            session={item}
            programName={item.programId ? programNames.get(item.programId) : undefined}
            onDelete={handleDelete}
            onToggleScroll={setScrollEnabled}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: LAYOUT.gutter, paddingBottom: 100 },
  card: { padding: SPACE.md, gap: SPACE.md },
  details: { gap: SPACE.lg },
  notes: {
    padding: SPACE.md + 2,
    gap: SPACE.xs,
    backgroundColor: SURFACE.blueTint,
    borderColor: SURFACE.blueBorder,
  },
  sets: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
});

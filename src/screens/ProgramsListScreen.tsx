import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart2, ChevronRight, Clock3, Play, Plus, Settings2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import ActivityComboChart from "@/components/Home/ActivityComboChart";
import StartWorkoutSheet from "@/components/Home/StartWorkoutSheet";
import { ProgramTile } from "@/components/ProgramTile";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, LAYOUT, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import {
  activityRangeStart,
  buildActivitySummary,
  formatDurationMinutes,
  type ActivityPeriodMode,
} from "@/utils/activitySummary";
import type { Program } from "@/types";

const PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

/** Home: activity summary, quick actions, saved routines. */
export default function ProgramsListScreen() {
  const router = useRouter();
  const hasActiveSession = useWorkoutSessionStore((s) => s.activeSession !== null);
  const startQuickSession = useWorkoutSessionStore((s) => s.startQuickSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);
  const allPrograms = useProgramStore(useShallow((s) => s.programs));
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const togglePin = useProgramStore((s) => s.togglePin);

  const [periodMode, setPeriodMode] = useState<ActivityPeriodMode>("week");
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [startVisible, setStartVisible] = useState(false);

  const sinceIso = useMemo(
    () => activityRangeStart(periodMode, new Date()).toISOString(),
    [periodMode],
  );
  const recent = useDbQuery(() => workoutRepo.summariesSince(sinceIso), [sinceIso]);
  const summary = useMemo(
    () => buildActivitySummary(recent, periodMode, new Date()),
    [recent, periodMode],
  );
  const lastUsed = useDbQuery(() => workoutRepo.lastUsedByProgram());

  const programs = useMemo(
    () =>
      [...allPrograms].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        const diff = (lastUsed.get(b._id) ?? 0) - (lastUsed.get(a._id) ?? 0);
        return diff !== 0 ? diff : b.updatedAt - a.updatedAt;
      }),
    [allPrograms, lastUsed],
  );

  const goToWorkout = () => router.replace("/workout");
  const handlePrimary = () => (hasActiveSession ? goToWorkout() : setStartVisible(true));
  const handleStartBlank = () => {
    startQuickSession();
    goToWorkout();
  };
  const handleStartProgram = (program: Program) => {
    const start = () => {
      startFromProgram(program);
      goToWorkout();
    };
    if (hasActiveSession)
      showConfirm(
        "Active workout",
        "You already have a workout in progress. Discard it and start this one?",
        start,
      );
    else start();
  };
  const handleDeleteProgram = (id: string, name: string) =>
    showConfirm("Delete routine", `Delete "${name}"? This cannot be undone.`, () =>
      deleteProgram(id),
    );

  return (
    <View style={UI.screen}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          scrollEnabled={scrollEnabled}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={TYPE.title}>Activities</Text>
              <Text style={[TYPE.label, { marginTop: SPACE.xs }]}>{summary.rangeLabel}</Text>
            </View>
            <IconButton size="md" onPress={() => router.push("/settings")}>
              <Settings2 size={18} color={COLORS.TEXT_SECONDARY} />
            </IconButton>
          </View>

          <SegmentedControl options={PERIODS} value={periodMode} onChange={setPeriodMode} />

          <View style={[UI.card, styles.summaryCard]}>
            <View style={UI.rowBetween}>
              <Text style={TYPE.bodyMuted}>Duration</Text>
              <Text style={TYPE.monoSmall}>
                {summary.sessions} session{summary.sessions === 1 ? "" : "s"}
              </Text>
            </View>
            <Text style={[TYPE.monoHero, { marginBottom: SPACE.md }]}>
              {formatDurationMinutes(summary.totalMinutes)}
            </Text>
            <ActivityComboChart
              points={summary.points}
              width={LAYOUT.screenWidth - LAYOUT.gutter * 2 - SPACE.lg * 2 - 2}
            />
          </View>

          {hasActiveSession ? (
            <Pressable
              onPress={goToWorkout}
              style={({ pressed }) => [UI.card, styles.resumeCard, pressed && UI.pressed]}
            >
              <View>
                <Text style={TYPE.label}>In progress</Text>
                <Text style={[TYPE.monoMedium, { marginTop: SPACE.xs }]}>Resume workout</Text>
              </View>
              <ChevronRight size={18} color={COLORS.ACCENT_BLUE} />
            </Pressable>
          ) : null}

          <View style={styles.metrics}>
            <View style={[UI.card, styles.metric]}>
              <Text style={TYPE.bodyMuted}>Sessions</Text>
              <Text style={TYPE.monoLarge}>{summary.sessions}</Text>
              <Text style={TYPE.caption}>{periodMode}</Text>
            </View>
            <View style={[UI.card, styles.metric]}>
              <Text style={TYPE.bodyMuted}>Average</Text>
              <Text style={TYPE.monoLarge}>{formatDurationMinutes(summary.averageMinutes)}</Text>
              <Text style={TYPE.caption}>per session</Text>
            </View>
            <Pressable
              onPress={() => router.push("/history")}
              style={({ pressed }) => [UI.card, styles.metric, pressed && UI.pressed]}
            >
              <Clock3 size={18} color={COLORS.TEXT_SECONDARY} />
              <Text style={TYPE.monoMedium}>History</Text>
              <Text style={TYPE.caption}>All workouts</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/stats")}
              style={({ pressed }) => [UI.card, styles.metric, pressed && UI.pressed]}
            >
              <BarChart2 size={18} color={COLORS.TEXT_SECONDARY} />
              <Text style={TYPE.monoMedium}>Insights</Text>
              <Text style={TYPE.caption}>Exercise stats</Text>
            </Pressable>
          </View>

          <Text style={[TYPE.titleSm, styles.sectionTitle]}>Routines</Text>
          {programs.length === 0 ? (
            <View style={[UI.card, styles.emptyRoutines]}>
              <EmptyState title="No routines yet" subtitle="Tap + to build your first one." />
            </View>
          ) : (
            programs.map((program) => (
              <ProgramTile
                key={program._id}
                program={program}
                lastUsedAt={lastUsed.get(program._id)}
                onPress={(id) => router.push(`/programs/${id}`)}
                onStart={handleStartProgram}
                onDelete={handleDeleteProgram}
                onPin={togglePin}
                onToggleScroll={setScrollEnabled}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <View style={styles.floatingWrap} pointerEvents="box-none">
        <View style={[UI.hudBar, UI.shadow, styles.floating]}>
          <IconButton tone="primary" onPress={() => router.push("/programs/create")}>
            <Plus size={20} color={COLORS.ACCENT_BLUE} />
          </IconButton>
          <Text style={[TYPE.label, styles.floatingLabel]}>
            {hasActiveSession ? "Workout in progress" : "Ready to train"}
          </Text>
          <Button
            label={hasActiveSession ? "Resume" : "Start"}
            tone="success"
            variant="filled"
            icon={
              <Play
                size={16}
                color={buttonForeground("success", "filled")}
                fill={buttonForeground("success", "filled")}
              />
            }
            onPress={handlePrimary}
          />
        </View>
      </View>

      <StartWorkoutSheet
        visible={startVisible}
        onClose={() => setStartVisible(false)}
        programs={programs}
        lastUsed={lastUsed}
        onStartBlank={handleStartBlank}
        onStartProgram={handleStartProgram}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: LAYOUT.gutter, paddingBottom: 140, gap: SPACE.md + 2 },
  headerRow: {
    paddingTop: SPACE.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryCard: { padding: SPACE.lg, gap: SPACE.sm },
  resumeCard: {
    minHeight: 72,
    borderColor: SURFACE.blueBorder,
    paddingHorizontal: SPACE.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  metric: { width: "48%", minHeight: 128, padding: SPACE.md + 2, justifyContent: "space-between" },
  sectionTitle: { marginTop: SPACE.sm },
  emptyRoutines: { paddingVertical: SPACE.sm },
  floatingWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: SPACE.xxl + SPACE.xs,
    alignItems: "center",
  },
  floating: { width: LAYOUT.screenWidth - LAYOUT.gutter * 2, height: 72, gap: SPACE.sm },
  floatingLabel: { flex: 1, paddingHorizontal: SPACE.xs, color: COLORS.TEXT_SECONDARY },
});

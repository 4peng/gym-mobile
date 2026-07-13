import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BarChart2,
  ChevronRight,
  Clock3,
  Play,
  Plus,
  RotateCcw,
  Settings2,
} from "lucide-react-native";
import ActivityComboChart from "@/components/Home/ActivityComboChart";
import { ProgramTile } from "@/components/ProgramTile";
import { useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useSyncStore } from "@/stores/syncStore";
import { COLORS, withAlpha } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import {
  buildActivitySummary,
  formatDurationMinutes,
  type ActivityPeriodMode,
} from "@/utils/activitySummary";
import type { Program } from "@/types";

export default function ProgramsListScreen() {
  const router = useAppRouter();

  const isManualSync = useSyncStore((s) => s.isManualSync);
  const runFullSync = useSyncStore((s) => s.runFullSync);

  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startQuickSession = useWorkoutSessionStore((s) => s.startQuickSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);
  const allHistory = useWorkoutSessionStore((s) => s.history);

  const allPrograms = useProgramStore((s) => s.programs);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const togglePin = useProgramStore((s) => s.togglePin);

  const [periodMode, setPeriodMode] = useState<ActivityPeriodMode>("week");
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const history = useMemo(
    () => allHistory.filter((session) => !session.deletedAt),
    [allHistory]
  );
  const summary = useMemo(
    () => buildActivitySummary(history, periodMode, new Date()),
    [history, periodMode]
  );

  const lastUsedByProgramId = useMemo(() => {
    const usage = new Map<string, number>();

    history.forEach((session) => {
      if (!session.programId) return;
      const ts = session.completedAt
        ? new Date(session.completedAt).getTime()
        : new Date(session.startedAt).getTime();
      const current = usage.get(session.programId) ?? 0;
      if (ts > current) {
        usage.set(session.programId, ts);
      }
    });

    return usage;
  }, [history]);

  const programs = useMemo(() => {
    return allPrograms
      .filter((program) => !program.deletedAt)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        const aLastUsed = lastUsedByProgramId.get(a._id) ?? 0;
        const bLastUsed = lastUsedByProgramId.get(b._id) ?? 0;
        if (aLastUsed !== bLastUsed) return bLastUsed - aLastUsed;

        return b.updatedAt - a.updatedAt;
      });
  }, [allPrograms, lastUsedByProgramId]);

  const primaryTitle = activeSession ? "Resume" : "Start";

  const handlePrimaryAction = useCallback(() => {
    if (activeSession) {
      router.replace("/workout");
      return;
    }

    startQuickSession();
    router.replace("/workout");
  }, [activeSession, router, startQuickSession]);

  const handleCreate = useCallback(() => {
    router.push("/programs/create");
  }, [router]);

  const handleProgramPress = useCallback(
    (id: string) => router.push(`/programs/${id}`),
    [router]
  );

  const handleStartProgram = useCallback(
    (program: Program) => {
      if (activeSession) {
        showConfirm(
          "Active Workout",
          "You already have a workout in progress. Discard it and start this one?",
          () => {
            startFromProgram(program);
            router.replace("/workout");
          }
        );
      } else {
        startFromProgram(program);
        router.replace("/workout");
      }
    },
    [activeSession, startFromProgram, router]
  );

  const handleDeleteProgram = useCallback(
    (id: string, name: string) => {
      showConfirm(
        "Delete Program",
        `Are you sure you want to delete "${name}"? This cannot be undone.`,
        () => deleteProgram(id)
      );
    },
    [deleteProgram]
  );

  const handlePinProgram = useCallback(
    (id: string) => togglePin(id),
    [togglePin]
  );

  const handleOptionsProgram = useCallback(
    (program: Program) => router.push(`/programs/${program._id}`),
    [router]
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={scrollEnabled}
          refreshControl={
            <RefreshControl
              refreshing={isManualSync}
              onRefresh={() => runFullSync(true)}
              tintColor={COLORS.ACCENT_BLUE}
            />
          }
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Activities</Text>
              <Text style={styles.headerRange}>{summary.rangeLabel}</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => runFullSync(true)}
                style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
              >
                <RotateCcw size={18} color={COLORS.TEXT_SECONDARY} />
              </Pressable>

              <Pressable
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
              >
                <Settings2 size={18} color={COLORS.TEXT_SECONDARY} />
              </Pressable>
            </View>
          </View>

          <View style={styles.segmentRow}>
            {(["week", "month", "year"] as ActivityPeriodMode[]).map((option) => {
              const active = periodMode === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setPeriodMode(option)}
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    active && styles.segmentBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryMeta}>
                {summary.sessions} session{summary.sessions === 1 ? "" : "s"}
              </Text>
            </View>

            <Text style={styles.summaryValue}>
              {formatDurationMinutes(summary.totalMinutes)}
            </Text>

            <ActivityComboChart points={summary.points} width={UI.WIDTH - 68} />
          </View>

          {activeSession ? (
            <Pressable
              onPress={() => router.push("/workout")}
              style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.resumeLabel}>In progress</Text>
                <Text style={styles.resumeTitle}>Resume workout</Text>
              </View>
              <ChevronRight size={18} color={COLORS.ACCENT_BLUE} />
            </Pressable>
          ) : null}

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Sessions</Text>
              <Text style={styles.metricValue}>{summary.sessions}</Text>
              <Text style={styles.metricSubtext}>{periodMode}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Average</Text>
              <Text style={styles.metricValue}>
                {formatDurationMinutes(summary.averageMinutes)}
              </Text>
              <Text style={styles.metricSubtext}>per session</Text>
            </View>

            <Pressable
              onPress={() => router.push("/history")}
              style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}
            >
              <Clock3 size={18} color={COLORS.TEXT_SECONDARY} />
              <Text style={styles.metricActionTitle}>History</Text>
              <Text style={styles.metricSubtext}>All workouts</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/stats")}
              style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}
            >
              <BarChart2 size={18} color={COLORS.TEXT_SECONDARY} />
              <Text style={styles.metricActionTitle}>Insights</Text>
              <Text style={styles.metricSubtext}>Exercise stats</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Routines</Text>
          </View>

          {programs.length === 0 ? (
            <View style={styles.emptyRoutines}>
              <Text style={styles.emptyRoutinesText}>No routines yet</Text>
            </View>
          ) : (
            programs.map((program) => (
              <ProgramTile
                key={program._id}
                program={program}
                lastUsedAt={lastUsedByProgramId.get(program._id)}
                onPress={handleProgramPress}
                onStart={handleStartProgram}
                onDelete={handleDeleteProgram}
                onPin={handlePinProgram}
                onOptions={handleOptionsProgram}
                onToggleScroll={setScrollEnabled}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <View style={styles.floatingActionWrap} pointerEvents="box-none">
        <View style={[UI.SHARED.hudPill, styles.floatingAction]}>
          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [UI.SHARED.iconBtn, pressed && styles.pressed]}
          >
            <Plus size={20} color={COLORS.ACCENT_BLUE} />
          </Pressable>

          <View style={styles.hudCopy}>
            <Text style={styles.hudTitle}>
              {activeSession ? "Resume Workout" : "Quick Workout"}
            </Text>
          </View>

          <Pressable
            onPress={handlePrimaryAction}
            style={({ pressed }) => [styles.primaryActionBtn, pressed && styles.pressed]}
          >
            <Play size={18} color={COLORS.ACCENT_GREEN} fill={COLORS.ACCENT_GREEN} />
            <Text style={styles.primaryActionText}>{primaryTitle}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  headerRow: {
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 26,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  headerRange: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.84,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_ITEM,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: UI.RADIUS_ITEM,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: COLORS.BORDER,
  },
  segmentText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  segmentTextActive: {
    color: COLORS.TEXT_PRIMARY,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    padding: 16,
    marginBottom: 14,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  summaryMeta: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MONO,
  },
  summaryValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 34,
    fontFamily: FONT_FAMILIES.MONO,
    marginBottom: 14,
  },
  resumeCard: {
    minHeight: 72,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.ACCENT_BLUE, 0.4),
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resumeLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    marginBottom: 4,
  },
  resumeTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontFamily: FONT_FAMILIES.MONO,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    width: "48%",
    minHeight: 128,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    padding: 14,
    justifyContent: "space-between",
  },
  metricLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  metricValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 30,
    fontFamily: FONT_FAMILIES.MONO,
  },
  metricActionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontFamily: FONT_FAMILIES.MONO,
    marginTop: 10,
  },
  metricSubtext: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MONO,
  },
  sectionHeaderRow: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptyRoutines: {
    minHeight: 96,
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    backgroundColor: COLORS.CARD_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyRoutinesText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MONO,
  },
  floatingActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: "center",
  },
  floatingAction: {
    width: UI.WIDTH - 32,
    height: 72,
    paddingHorizontal: 8,
    gap: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  hudCopy: {
    flex: 1,
    paddingHorizontal: 4,
  },
  hudTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  primaryActionBtn: {
    minWidth: 96,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GREEN,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryActionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
});

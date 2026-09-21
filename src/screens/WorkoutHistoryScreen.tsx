import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  KeyboardAvoidingView,
  RefreshControl,
} from "react-native";
import {
  ChevronLeft,
  Calendar,
  Clock,
  ChevronDown,
  Dumbbell,
  ChevronUp,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { useSyncStore } from "@/stores/syncStore";
import { useShallow } from "zustand/react/shallow";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import type { WorkoutSession } from "@/types";
import { EditableSetTag } from "@/components/Workout/EditableSetTag";
import { promptForDate } from "@/utils/alerts";
import { withDatePart } from "@/utils/timestamps";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return "Unknown";
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(durationMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("default", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// ──────────────────────────────────────────────
// WorkoutSessionCard
// ──────────────────────────────────────────────

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
  const [isExpanded, setIsExpanded] = useState(false);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const updateSessionDate = useWorkoutSessionStore((s) => s.updateSessionDate);
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleEditDate = () => {
    const currentIso = session.completedAt || session.startedAt;
    promptForDate(currentIso, (newDate) =>
      updateSessionDate(session._id, withDatePart(currentIso, newDate)),
    );
  };

  const exerciseSummary = useMemo(
    () => session.exercises.map((e) => `${e.sets.length} × ${toTitleCase(e.name)}`).join(", "),
    [session.exercises],
  );

  return (
    <Swipeable onDelete={() => onDelete(session._id)} onToggleScroll={onToggleScroll}>
      <View style={[UI.SHARED.card, { marginBottom: 0, borderRadius: 0 }]}>
        <View style={{ padding: 12 }}>
          <View style={styles.cardHeader}>
            <Pressable
              onPress={handleEditDate}
              style={({ pressed }) => [styles.dateInfo, pressed && { opacity: 0.6 }]}
            >
              <Calendar size={14} color={COLORS.ACCENT_BLUE} />
              <Text style={styles.dateText}>
                {formatDate(session.completedAt || session.startedAt)}
              </Text>
            </Pressable>
            <Pressable onPress={toggleExpand} style={styles.headerRight}>
              {isExpanded ? (
                <ChevronUp size={20} color={COLORS.TEXT_TERTIARY} />
              ) : (
                <ChevronDown size={20} color={COLORS.TEXT_TERTIARY} />
              )}
            </Pressable>
          </View>

          <Pressable onPress={toggleExpand}>
            <Text style={styles.sessionTitle}>{programName || "Quick Session"}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={12} color={COLORS.ACCENT_YELLOW} />
                <Text style={styles.metaText}>
                  {formatDuration(session.startedAt, session.completedAt)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Dumbbell size={12} color={COLORS.ACCENT_GREEN} />
                <Text style={styles.metaText}>{session.exercises.length} exercises</Text>
              </View>
            </View>

            {!isExpanded && (
              <Text style={styles.summary} numberOfLines={1}>
                {exerciseSummary}
              </Text>
            )}
          </Pressable>
        </View>

        {isExpanded && (
          <View style={[styles.detailsContainer, { paddingHorizontal: 12, paddingBottom: 12 }]}>
            <View style={styles.divider} />
            {session.notes.trim().length > 0 ? (
              <View style={styles.sessionNotesBox}>
                <Text style={styles.sessionNotesLabel}>Workout Notes</Text>
                <Text style={styles.sessionNotesText}>{session.notes}</Text>
              </View>
            ) : null}
            {session.exercises.map((ex) => (
              <View key={ex.id} style={styles.exerciseDetailItem}>
                <Text style={styles.exerciseDetailName}>{toTitleCase(ex.name)}</Text>
                <View style={styles.setsList}>
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

// ──────────────────────────────────────────────
// WorkoutHistoryScreen
// ──────────────────────────────────────────────

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const allHistory = useWorkoutSessionStore(useShallow((s) => s.history));
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const runFullSync = useSyncStore((s) => s.runFullSync);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const history = useMemo(() => allHistory.filter((s) => !s.deletedAt), [allHistory]);

  const hasMoreHistoryOnServer = useWorkoutSessionStore((s) => s.hasMoreHistory);
  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const fetchMoreHistory = useWorkoutSessionStore((s) => s.fetchMoreHistory);
  const programs = useProgramStore(useShallow((s) => s.programs));
  const programsById = useMemo(() => {
    const map = new Map<string, (typeof programs)[number]>();
    for (const p of programs) {
      if (p.deletedAt) continue;
      map.set(p._id, p);
    }
    return map;
  }, [programs]);

  const [displayLimit, setDisplayLimit] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        "Delete Workout",
        "Are you sure you want to remove this session from your history?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              deleteHistorySession(id);
            },
          },
        ],
      );
    },
    [deleteHistorySession],
  );

  const handleLoadMore = async () => {
    if (loadingMore) return;

    if (history.length > displayLimit) {
      setDisplayLimit((prev) => prev + 10);
      return;
    }

    if (hasMoreHistoryOnServer) {
      setLoadingMore(true);
      try {
        await fetchMoreHistory();
        setDisplayLimit((prev) => prev + 10);
      } catch (err) {
        console.error("Failed to load more history:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: WorkoutSession }) => (
      <WorkoutSessionCard
        session={item}
        programName={item.programId ? programsById.get(item.programId)?.name : undefined}
        onDelete={handleDelete}
        onToggleScroll={setScrollEnabled}
      />
    ),
    [programsById, handleDelete],
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
            <ChevronLeft size={28} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
          <Text style={styles.headerTitle}>History</Text>
        </View>

        <FlatList
          data={history.slice(0, displayLimit)}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isSyncing}
              onRefresh={() => runFullSync()}
              tintColor={COLORS.ACCENT_BLUE}
              colors={[COLORS.ACCENT_BLUE]}
              progressBackgroundColor={COLORS.CARD_BG}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Clock size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
              <Text style={styles.emptyText}>No history yet.</Text>
              <Text style={styles.emptySubtext}>Complete your first workout to see it here.</Text>
            </View>
          }
          renderItem={renderItem}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.ACCENT_BLUE} />
              </View>
            ) : (
              <View style={{ height: 100 }} />
            )
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    paddingTop: UI.HEADER_TOP - 10,
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 100,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: FONT_FAMILIES.MONO,
  },
  summary: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: "500",
  },
  detailsContainer: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 16,
  },
  exerciseDetailItem: {
    marginBottom: 16,
  },
  sessionNotesBox: {
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.12)",
    borderRadius: UI.RADIUS_CONTAINER,
    padding: 14,
    marginBottom: 18,
  },
  sessionNotesLabel: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  sessionNotesText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  exerciseDetailName: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  setsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  footerLoader: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
  },
});

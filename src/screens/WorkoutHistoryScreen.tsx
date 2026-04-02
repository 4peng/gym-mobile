'use client';

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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { 
  ChevronLeft, 
  Calendar, 
  Clock, 
  ChevronDown, 
  Dumbbell, 
  ChevronUp,
  Check,
  X 
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import {
  useDeleteHistorySession,
  useFetchMoreWorkoutHistory,
  useHasMoreWorkoutHistory,
  useUpdateHistorySet,
  useUpdateSessionDate,
  useWorkoutHistory,
} from "@/stores/workoutHistoryStore";
import { useProgramStore } from "@/stores/programStore";
import { useSyncStore } from "@/stores/syncStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import type { WorkoutSession, WorkoutSet } from "@/types";

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
  return d.toLocaleDateString('default', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
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

const WorkoutSessionCard = ({ session, programName, onDelete, onToggleScroll }: WorkoutSessionCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateHistorySet = useUpdateHistorySet();
  const updateSessionDate = useUpdateSessionDate();
  
  const [editingSet, setEditingSet] = useState<{
    exerciseId: string;
    setId: string;
    weight: string;
    reps: string;
  } | null>(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleEditDate = () => {
    const currentFullDate = session.completedAt || session.startedAt;
    const currentDate = new Date(currentFullDate).toISOString().split('T')[0];
    
    if (Platform.OS === 'ios') {
      Alert.prompt(
        "Edit Date",
        "Enter new date (YYYY-MM-DD):",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Save", 
            onPress: (newDate?: string) => {
              if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                // Keep the time part if possible
                const oldTime = currentFullDate.split('T')[1] || "12:00:00.000Z";
                const updatedIso = `${newDate}T${oldTime}`;
                updateSessionDate(session._id, updatedIso);
              } else if (newDate) {
                Alert.alert("Invalid format", "Please use YYYY-MM-DD");
              }
            } 
          }
        ],
        "plain-text",
        currentDate
      );
    } else {
      Alert.alert("Feature limited", "Date editing is currently optimized for iOS. Please ensure you enter YYYY-MM-DD format if available via your system prompt.");
    }
  };

  const handleStartEdit = (exerciseId: string, set: WorkoutSet) => {
    setEditingSet({
      exerciseId,
      setId: set.id,
      weight: (set.weight ?? 0).toString(),
      reps: (set.reps ?? 0).toString(),
    });
  };

  const handleSaveEdit = () => {
    if (!editingSet) return;
    const w = parseFloat(editingSet.weight);
    const r = parseFloat(editingSet.reps);
    if (!isNaN(w) && !isNaN(r)) {
      updateHistorySet(session._id, editingSet.exerciseId, editingSet.setId, "weight", w);
      updateHistorySet(session._id, editingSet.exerciseId, editingSet.setId, "reps", r);
    }
    setEditingSet(null);
  };

  const exerciseSummary = session.exercises
    .map(e => `${e.sets.length} × ${toTitleCase(e.name)}`)
    .join(", ");

  return (
    <Swipeable onDelete={() => onDelete(session._id)} onToggleScroll={onToggleScroll}>
      <View style={[UI.SHARED.card, { marginBottom: 0, borderRadius: 0 }]}>
        <View style={{ padding: 12 }}>
          <View style={styles.cardHeader}>
            <Pressable onPress={handleEditDate} style={({ pressed }) => [styles.dateInfo, pressed && { opacity: 0.6 }]}>
              <Calendar size={14} color={COLORS.ACCENT_BLUE} />
              <Text style={styles.dateText}>{formatDate(session.completedAt || session.startedAt)}</Text>
            </Pressable>
            <Pressable onPress={toggleExpand} style={styles.headerRight}>
              {isExpanded ? <ChevronUp size={20} color={COLORS.TEXT_TERTIARY} /> : <ChevronDown size={20} color={COLORS.TEXT_TERTIARY} />}
            </Pressable>
          </View>

          <Pressable onPress={toggleExpand}>
            <Text style={styles.sessionTitle}>
              {programName || "Quick Session"}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={12} color={COLORS.ACCENT_YELLOW} />
                <Text style={styles.metaText}>{formatDuration(session.startedAt, session.completedAt)}</Text>
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
                  {ex.sets.map((s, sIdx) => {
                    const isEditing = editingSet?.setId === s.id;
                    
                    if (isEditing) {
                      return (
                        <View key={s.id} style={styles.editRow}>
                          <TextInput
                            style={styles.editInput}
                            value={editingSet.weight}
                            onChangeText={(v) => setEditingSet({ ...editingSet, weight: v })}
                            keyboardType="numeric"
                            autoFocus
                          />
                          <Text style={styles.setTagX}>×</Text>
                          <TextInput
                            style={styles.editInput}
                            value={editingSet.reps}
                            onChangeText={(v) => setEditingSet({ ...editingSet, reps: v })}
                            keyboardType="numeric"
                          />
                          <Pressable onPress={handleSaveEdit} style={styles.editIcon}>
                            <Check size={14} color={COLORS.ACCENT_GREEN} />
                          </Pressable>
                          <Pressable onPress={() => setEditingSet(null)} style={styles.editIcon}>
                            <X size={14} color={COLORS.DANGER} />
                          </Pressable>
                        </View>
                      );
                    }

                    return (
                      <Pressable 
                        key={s.id} 
                        style={styles.setTag}
                        onPress={() => handleStartEdit(ex.id, s)}
                      >
                        <Text style={styles.setTagText}>
                          {s.weight}<Text style={styles.setTagX}>×</Text>{s.reps}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Swipeable>
  );
};


// ──────────────────────────────────────────────
// WorkoutHistoryScreen
// ──────────────────────────────────────────────

export default function WorkoutHistoryScreen() {
  const router = useAppRouter();
  const allHistory = useWorkoutHistory();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const runFullSync = useSyncStore((s) => s.runFullSync);
  
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  const history = useMemo(() => 
    allHistory.filter(s => !s.deletedAt), 
    [allHistory]
  );

  const hasMoreHistoryOnServer = useHasMoreWorkoutHistory();
  const deleteHistorySession = useDeleteHistorySession();
  const fetchMoreHistory = useFetchMoreWorkoutHistory();
  const getProgramById = useProgramStore((s) => s.getProgramById);
  
  const [displayLimit, setDisplayLimit] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleDelete = (id: string) => {
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
          }
        }
      ]
    );
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;

    if (history.length > displayLimit) {
      setDisplayLimit(prev => prev + 10);
      return;
    }

    if (hasMoreHistoryOnServer) {
      setLoadingMore(true);
      try {
        await fetchMoreHistory();
        setDisplayLimit(prev => prev + 10);
      } catch (err) {
        console.error("Failed to load more history:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const hasMoreToShow = history.length > displayLimit || hasMoreHistoryOnServer;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
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
          renderItem={({ item }) => (
            <WorkoutSessionCard
              session={item}
              programName={item.programId ? getProgramById(item.programId)?.name : undefined}
              onDelete={handleDelete}
              onToggleScroll={setScrollEnabled}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.ACCENT_BLUE} />
              </View>
            ) : <View style={{ height: 100 }} />
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
    borderRadius: 16,
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
  setTag: {
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.1)",
  },
  setTagText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "800",
  },
  setTagX: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    marginHorizontal: 2,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_BLUE,
  },
  editInput: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    padding: 0,
    width: 35, // Fixed width prevents disappearing text
  },
  editIcon: {
    marginLeft: 4,
    padding: 2,
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  loadMoreText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

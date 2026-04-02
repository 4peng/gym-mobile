'use client';

import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  ScrollView,
  Animated,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, Plus, ChevronRight, Activity, BarChart2, Clock, Settings, Pin, Zap, X } from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useSyncStore } from "@/stores/syncStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { Swipeable } from "@/src/components/Swipeable";
import { ProgramTile } from "@/src/components/ProgramTile";
import type { Program } from "@/types";

// ──────────────────────────────────────────────
// ProgramsListScreen
// ──────────────────────────────────────────────

export default function ProgramsListScreen() {
  const allPrograms = useProgramStore((s) => s.programs);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const togglePin = useProgramStore((s) => s.togglePin);

  const isSyncing = useSyncStore((s) => s.isSyncing);
  const isManualSync = useSyncStore((s) => s.isManualSync);
  const runFullSync = useSyncStore((s) => s.runFullSync);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleMenu = useCallback(() => {
    const toValue = isExpanded ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
    setIsExpanded(!isExpanded);
  }, [isExpanded, animation]);

  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startQuickSession = useWorkoutSessionStore((s) => s.startQuickSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);
  const allHistory = useWorkoutSessionStore((s) => s.history);
  const history = useMemo(() => allHistory.filter(s => !s.deletedAt), [allHistory]);

  const programs = useMemo(() => {
    return [...allPrograms]
      .filter(p => !p.deletedAt)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });
  }, [allPrograms]);

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

  const sortProgramsByRecentUse = useCallback((items: Program[]) => {
    return [...items].sort((a, b) => {
      const aLastUsed = lastUsedByProgramId.get(a._id) ?? 0;
      const bLastUsed = lastUsedByProgramId.get(b._id) ?? 0;
      if (aLastUsed !== bLastUsed) return bLastUsed - aLastUsed;

      return b.updatedAt - a.updatedAt;
    });
  }, [lastUsedByProgramId]);

  const recentPrograms = useMemo(
    () => sortProgramsByRecentUse(programs),
    [programs, sortProgramsByRecentUse]
  );

  const router = useAppRouter();

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  }, []);

  const handlePress = useCallback((id: string) => router.push(`/programs/${id}`), [router]);

  const handleStartProgram = useCallback((program: Program) => {
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
  }, [activeSession, startFromProgram, router]);

  const handleQuickStartAction = useCallback(() => {
    if (isExpanded) toggleMenu();
    if (activeSession) {
      router.replace("/workout");
    } else {
      startQuickSession();
      router.replace("/workout");
    }
  }, [activeSession, startQuickSession, router, isExpanded, toggleMenu]);

  const handleSelectProgramAction = useCallback((program: Program) => {
    if (isExpanded) toggleMenu();
    handleStartProgram(program);
  }, [handleStartProgram, isExpanded, toggleMenu]);

  const handleDelete = useCallback((id: string, name: string) => {
    showConfirm(
      "Delete Program",
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteProgram(id);
      }
    );
  }, [deleteProgram]);

  const handleCreate = useCallback(() => router.push("/programs/create"), [router]);

  const handlePin = useCallback((id: string) => {
    // Only animate the layout specifically when pinning/unpinning
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    togglePin(id);
  }, [togglePin]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <Animated.ScrollView 
          showsVerticalScrollIndicator={false}
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={scrollEnabled}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isManualSync}
              onRefresh={() => runFullSync(true)}
              tintColor={COLORS.ACCENT_BLUE}
            />
          }
        >
          {/* Dynamic Header Area */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{todayStr}</Text>
              <Text style={styles.headerTitle}>My Programs</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable 
                onPress={() => router.push("/settings")} 
                style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
              >
                <Settings size={22} color={COLORS.TEXT_TERTIARY} />
              </Pressable>
              <Pressable 
                onPress={handleCreate} 
                style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
              >
                <Plus size={24} color={COLORS.ACCENT_BLUE} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Activity Insights Row */}
          <View style={styles.insightsRow}>
            <Pressable 
              onPress={() => router.push("/history")}
              style={({ pressed }) => [UI.SHARED.card, { flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && styles.insightCardPressed]}
            >
              <View style={[styles.insightIconCircle, { backgroundColor: "rgba(11, 130, 255, 0.1)" }]}>
                <Clock size={20} color={COLORS.ACCENT_BLUE} />
              </View>
              <View>
                <Text style={styles.insightLabel}>History</Text>
                <Text style={styles.insightSublabel}>{history.length} sessions</Text>
              </View>
            </Pressable>

            <Pressable 
              onPress={() => router.push("/stats")}
              style={({ pressed }) => [UI.SHARED.card, { flex: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && styles.insightCardPressed]}
            >
              <View style={[styles.insightIconCircle, { backgroundColor: "rgba(16, 217, 75, 0.1)" }]}>
                <BarChart2 size={20} color={COLORS.ACCENT_GREEN} />
              </View>
              <View>
                <Text style={styles.insightLabel}>Insights</Text>
                <Text style={styles.insightSublabel}>Volume & PRs</Text>
              </View>
            </Pressable>
          </View>

          {/* Active Session Card (If exists) */}
          {activeSession && (
            <View style={styles.activeContainer}>
              <Text style={[UI.SHARED.sectionLabel, { marginLeft: 8 }]}>Active Session</Text>
              <Pressable
                style={({ pressed }) => [
                  UI.SHARED.card,
                  { paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderColor: "rgba(11, 130, 255, 0.2)" },
                  pressed && { opacity: 0.85 }
                ]}
                onPress={() => router.push("/workout")}
              >
                <View style={styles.activeIndicator} />
                <Text style={styles.activeBannerText}>Workout in progress—resume now</Text>
                <ChevronRight size={16} color={COLORS.ACCENT_BLUE} />
              </Pressable>
            </View>
          )}

          {/* Main List */}
          <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
            <Text style={[UI.SHARED.sectionLabel, { marginLeft: 8 }]}>Available Routines</Text>
            {programs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Activity size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
                <Text style={styles.emptyText}>No programs yet.</Text>
                <Text style={styles.emptySubtext}>Create your first custom workout to get started.</Text>
              </View>
            ) : (
              <View style={{ gap: 0 }}>
                {programs.map((item) => (
                  <ProgramTile
                    key={item._id}
                    program={item}
                    onPress={handlePress}
                    onStart={handleStartProgram}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onToggleScroll={setScrollEnabled}
                  />
                ))}
              </View>
            )}
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      {/* Speed Dial Menu Overlay */}
      {isExpanded && (
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={toggleMenu}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </Pressable>
      )}

      <View style={styles.fabContainer}>
        {/* Sub-buttons (Routines) */}
        {recentPrograms.slice(0, 3).map((p, i) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -70 * (i + 2)],
          });
          const opacity = animation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });

          return (
            <Animated.View
              key={p._id}
              style={[
                styles.subFabWrapper,
                { transform: [{ translateY }], opacity }
              ]}
            >
              <Text style={styles.subFabLabel}>{p.name}</Text>
              <Pressable
                onPress={() => handleSelectProgramAction(p)}
                style={({ pressed }) => [
                  styles.subFab,
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Activity size={20} color={COLORS.ACCENT_BLUE} />
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Empty Workout Button */}
        <Animated.View
          style={[
            styles.subFabWrapper,
            {
              transform: [{
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -70],
                })
              }],
              opacity: animation
            }
          ]}
        >
          <Text style={styles.subFabLabel}>Empty Workout</Text>
          <Pressable
            onPress={handleQuickStartAction}
            style={({ pressed }) => [
              styles.subFab,
              { backgroundColor: 'rgba(11, 130, 255, 0.1)', borderColor: 'rgba(11, 130, 255, 0.2)' },
              pressed && { opacity: 0.8 }
            ]}
          >
            <Zap size={20} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
          </Pressable>
        </Animated.View>

        {/* Main FAB */}
        <Pressable 
          onPress={toggleMenu} 
          style={({ pressed }) => [
            styles.fab,
            pressed && { transform: [{ scale: 0.95 }] }
          ]}
        >
          <Animated.View style={{
            transform: [{
              rotate: animation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '45deg']
              })
            }]
          }}>
            {isExpanded ? (
              <X size={28} color="#FFFFFF" strokeWidth={3} />
            ) : (
              <Play size={28} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120, // Space for FAB
  },
  header: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingTop: 16, // Reduced since SafeAreaView handles the top
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  greeting: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: UI.GAP,
    marginBottom: 4,
  },
  insightsRow: {
    flexDirection: "row",
    paddingHorizontal: UI.LAYOUT_PADDING,
    gap: UI.GAP,
    marginBottom: 32,
  },
  insightCardPressed: {
    backgroundColor: COLORS.CARD_HOVER,
  },
  insightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  insightLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  insightSublabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  activeContainer: {
    marginBottom: 32,
    paddingHorizontal: UI.LAYOUT_PADDING,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.ACCENT_BLUE,
    marginRight: 12,
  },
  activeBannerText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 8,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  fabContainer: {
    position: "absolute",
    bottom: 40,
    right: 30,
    alignItems: 'flex-end',
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.ACCENT_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  subFabWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 250,
    right: 0,
    paddingRight: 8,
  },
  subFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  subFabLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

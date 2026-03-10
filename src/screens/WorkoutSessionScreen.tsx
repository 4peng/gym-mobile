'use client';

import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  InteractionManager,
  Platform,
  LayoutAnimation,
  KeyboardAvoidingView,
} from "react-native";
import { 
  X, 
  Check, 
  Plus, 
  Dumbbell,
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import {
  useActiveSession,
  useAddExercise,
  useCompleteSession,
  useDiscardSession,
  useClearExpiredTimer,
} from "@/stores/activeSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from "@/utils/notifications";
import FloatingRestTimer from "@/components/FloatingRestTimer";
import LiveWorkoutTimer from "@/components/LiveWorkoutTimer";
import { HapticFeedback } from "@/utils/haptics";
import { ExerciseCard } from "@/components/Workout/ExerciseCard";

const SUGGESTED_EXERCISES = [
  "Bench Press",
  "Squat",
  "Deadlift",
  "Overhead Press",
  "Pull Ups",
  "Barbell Row",
  "Dumbbell Curls",
  "Lateral Raises",
];

export default function WorkoutSessionScreen() {
  const activeSession = useActiveSession();
  const addExercise = useAddExercise();
  const completeSession = useCompleteSession();
  const discardSession = useDiscardSession();
  const clearExpiredTimer = useClearExpiredTimer();

  const router = useAppRouter();
  const [newExerciseName, setNewExerciseName] = React.useState("");

  const placeholderIndex = (activeSession?.exercises.length ?? 0) % SUGGESTED_EXERCISES.length;
  const currentPlaceholder = SUGGESTED_EXERCISES[placeholderIndex];

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      configureNotificationHandler();
      requestNotificationPermissions();
    });
    
    clearExpiredTimer();
    
    return () => task.cancel();
  }, [clearExpiredTimer]);

  const handleAddExercise = useCallback(() => {
    const trimmed = newExerciseName.trim();
    const finalName = trimmed === "" ? currentPlaceholder : trimmed;
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise(finalName);
    setNewExerciseName("");
  }, [newExerciseName, addExercise, currentPlaceholder]);

  const handleFinish = useCallback(() => {
    showConfirm(
      "Finish Workout",
      "Complete this workout session?",
      () => {
        HapticFeedback.success();
        completeSession();
        setTimeout(() => {
          router.replace("/programs/");
        }, 100);
      }
    );
  }, [completeSession, router]);

  const handleDiscard = useCallback(() => {
    showConfirm(
      "Discard Workout",
      "Are you sure? This cannot be undone.",
      () => {
        discardSession();
        setTimeout(() => {
          router.replace("/programs/");
        }, 100);
      }
    );
  }, [discardSession, router]);

  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Dumbbell size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
          <Text style={styles.emptyText}>No active session</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.timerRow}>
              <LiveWorkoutTimer startedAt={activeSession.startedAt} />
            </View>
            <Text style={styles.headerTitle}>Live Training</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={handleDiscard} 
              style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
            >
              <X size={24} color={COLORS.DANGER} />
            </Pressable>
            <Pressable 
              onPress={handleFinish} 
              style={({ pressed }) => [UI.SHARED.actionBtn, pressed && { transform: [{scale: 0.96}] }]}
            >
              <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={activeSession.exercises}
          renderItem={({ item }) => <ExerciseCard exercise={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <View style={styles.addExerciseSection}>
              <Text style={UI.SHARED.sectionLabel}>Next Exercise</Text>
              <View style={styles.addExerciseCard}>
                <View style={styles.addExerciseInputContainer}>
                  <TextInput
                    style={styles.addExerciseInput}
                    placeholder={currentPlaceholder}
                    placeholderTextColor={COLORS.TEXT_TERTIARY}
                    value={newExerciseName}
                    onChangeText={setNewExerciseName}
                    onSubmitEditing={handleAddExercise}
                    returnKeyType="done"
                  />
                </View>
                <Pressable 
                  onPress={handleAddExercise} 
                  style={({ pressed }) => [
                    styles.addExerciseBtn,
                    pressed && { transform: [{scale: 0.96}], opacity: 0.9 }
                  ]}
                >
                  <Plus size={24} color="#FFFFFF" strokeWidth={3} />
                </Pressable>
              </View>
            </View>
          }
        />

        <FloatingRestTimer />
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
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingTop: UI.HEADER_TOP,
    paddingBottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleGroup: {
    flex: 1,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  headerActions: {
    flexDirection: "row",
    gap: UI.GAP,
  },
  listContent: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 160,
  },
  addExerciseSection: {
    marginTop: 8,
    marginBottom: 100,
  },
  addExerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: 28,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  addExerciseInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 56,
  },
  addExerciseInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    padding: 0,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  addExerciseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.ACCENT_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});

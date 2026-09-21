import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { generateId } from "@/utils/id";
import { USER_ID } from "@/constants/user";
import { COLORS, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";
import type { MuscleGroup } from "@/constants/muscles";
import type { WorkoutSession } from "@/types";

const ROUTINES: { name: string; exercises: { name: string; muscles: MuscleGroup[] }[] }[] = [
  {
    name: "Push Day",
    exercises: [
      { name: "Bench Press", muscles: ["chest", "shoulder"] },
      { name: "Overhead Press", muscles: ["shoulder"] },
      { name: "Tricep Pushdowns", muscles: ["arms"] },
    ],
  },
  {
    name: "Pull Day",
    exercises: [
      { name: "Deadlift", muscles: ["back", "hamstrings", "glutes"] },
      { name: "Pullups", muscles: ["back"] },
      { name: "Bicep Curls", muscles: ["arms"] },
    ],
  },
  {
    name: "Legs",
    exercises: [
      { name: "Squat", muscles: ["quads", "glutes"] },
      { name: "Leg Press", muscles: ["quads"] },
      { name: "Calf Raises", muscles: ["calves"] },
    ],
  },
];

/** Dev-only: injects 90 days of completed sessions into the local database. */
export default function MockDataInjector() {
  const router = useRouter();
  const [status, setStatus] = useState("Ready to inject 90 days of data");

  if (!__DEV__) return null;

  const injectData = () => {
    setStatus("Injecting...");
    const now = new Date();
    const sessions: WorkoutSession[] = [];

    for (let daysAgo = 90; daysAgo >= 0; daysAgo -= 2) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const routine = ROUTINES[Math.floor(Math.random() * ROUTINES.length)];
      const progress = (90 - daysAgo) / 10; // ~1kg per session of progressive overload

      sessions.push({
        _id: generateId(),
        userId: USER_ID,
        startedAt: date.toISOString(),
        completedAt: new Date(date.getTime() + 3_600_000).toISOString(),
        updatedAt: Date.now(),
        notes: "",
        exercises: routine.exercises.map((ex) => ({
          id: generateId(),
          name: ex.name,
          trackingMode: "strength",
          restSeconds: 90,
          notes: "",
          muscles: ex.muscles,
          weightUnit: "kg",
          sets: [1, 2, 3].map(() => ({
            id: generateId(),
            weight: 40 + progress,
            reps: 10,
            type: "working",
            completedAt: date.toISOString(),
          })),
        })),
      });
    }

    useWorkoutSessionStore.getState().importWorkouts(sessions, true);
    setStatus(`Success! Injected ${sessions.length} sessions.`);
    setTimeout(() => router.replace("/programs/"), 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={[TYPE.title, styles.center]}>Mock Data Injector</Text>
      <Text style={[TYPE.bodyMuted, styles.center, styles.status]}>{status}</Text>
      <Pressable style={({ pressed }) => [styles.btn, pressed && UI.pressed]} onPress={injectData}>
        <Text style={TYPE.body}>Inject 90 Days of History</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && UI.pressed]}
        onPress={() => router.back()}
      >
        <Text style={TYPE.body}>Go Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
    justifyContent: "center",
    padding: SPACE.xxxl + SPACE.sm,
    gap: SPACE.lg,
  },
  center: { textAlign: "center" },
  status: { marginBottom: SPACE.xl },
  btn: {
    backgroundColor: COLORS.ACCENT_BLUE,
    padding: SPACE.xl,
    borderRadius: RADIUS.container,
    alignItems: "center",
  },
  btnSecondary: { backgroundColor: COLORS.CARD_HOVER },
});

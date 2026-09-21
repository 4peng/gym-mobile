import { Redirect } from "expo-router";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

export default function Index() {
  const hasActiveSession = useWorkoutSessionStore((s) => s.activeSession !== null);
  return <Redirect href={hasActiveSession ? "/workout" : "/programs/"} />;
}

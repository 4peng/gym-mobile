import { useLocalSearchParams } from "expo-router";
import ExerciseVolumeScreen from "@/src/screens/ExerciseVolumeScreen";

export default function ExerciseVolumeRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  
  return <ExerciseVolumeScreen exerciseName={name} />;
}

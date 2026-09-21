import { useLocalSearchParams } from "expo-router";
import ExerciseVolumeScreen from "@/screens/ExerciseVolumeScreen";

export default function ExerciseVolumeRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();

  return <ExerciseVolumeScreen exerciseKey={name} />;
}

import { Stack } from "expo-router";
import { COLORS } from "@/src/constants/colors";

export default function ProgramsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.BG },
        animation: 'slide_from_right',
      }}
    />
  );
}

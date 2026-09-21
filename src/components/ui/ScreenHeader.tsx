import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS, LAYOUT, SPACE, TYPE } from "@/constants/theme";
import { IconButton } from "./IconButton";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Show a back chevron that pops the stack. */
  back?: boolean;
  /** Right-aligned actions. */
  right?: ReactNode;
}

/** Standard screen header: optional back button, title, optional right actions. */
export function ScreenHeader({ title, subtitle, back, right }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton onPress={() => router.back()}>
          <ChevronLeft size={26} color={COLORS.TEXT_PRIMARY} />
        </IconButton>
      ) : null}
      <View style={styles.titles}>
        <Text style={TYPE.title}>{title}</Text>
        {subtitle ? <Text style={[TYPE.label, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: LAYOUT.headerTop,
    paddingHorizontal: LAYOUT.gutter,
    paddingBottom: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  titles: { flex: 1 },
  subtitle: { marginTop: SPACE.xs },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});

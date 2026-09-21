import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, SET_TYPE_COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";

/** Warmup / working / dropset colour key, shown on long-press of a set marker. */
export function SetTypeLegend({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.popup, style]}>
      {(["warmup", "working", "dropset"] as const).map((type) => (
        <View key={type} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: SET_TYPE_COLORS[type] }]} />
          <Text style={styles.text}>{type.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    backgroundColor: "rgba(18, 18, 18, 0.95)",
    padding: 10,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    zIndex: 1000,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  item: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 9,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "900",
  },
});

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, RADIUS, SET_TYPE_COLORS, SPACE, SURFACE, TYPE } from "@/constants/theme";

/** Warmup / working / dropset colour key, shown on long-press of a set marker. */
export function SetTypeLegend({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.popup, style]}>
      {(["warmup", "working", "dropset"] as const).map((type) => (
        <View key={type} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: SET_TYPE_COLORS[type] }]} />
          <Text style={[TYPE.label, styles.text]}>{type}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    backgroundColor: SURFACE.sheet,
    padding: SPACE.sm + 2,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    zIndex: 1000,
    gap: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  item: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: COLORS.TEXT_PRIMARY, fontSize: 9, letterSpacing: 0.5 },
});

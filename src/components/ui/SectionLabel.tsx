import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { SPACE, TYPE } from "@/constants/theme";

/** Small-caps section heading above a card or list. */
export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[TYPE.label, styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { marginBottom: SPACE.sm, marginLeft: SPACE.xs },
});

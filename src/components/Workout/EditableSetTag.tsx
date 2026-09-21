import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";

interface EditableSetTagProps {
  weight: number | null;
  reps: number | null;
  onSave: (weight: number, reps: number) => void;
}

/** "100 × 8" chip that flips into an inline weight/reps editor on tap. Blank fields keep their old value. */
export function EditableSetTag({ weight, reps, onSave }: EditableSetTagProps) {
  const [draft, setDraft] = useState<{ weight: string; reps: string } | null>(null);

  if (!draft) {
    return (
      <Pressable
        style={({ pressed }) => [styles.tag, pressed && UI.pressed]}
        onPress={() =>
          setDraft({
            weight: weight == null ? "" : String(weight),
            reps: reps == null ? "" : String(reps),
          })
        }
      >
        <Text style={styles.tagText}>
          {weight ?? "-"} <Text style={styles.tagX}>×</Text> {reps ?? "-"}
        </Text>
      </Pressable>
    );
  }

  const save = () => {
    const parse = (text: string, fallback: number | null) => {
      const trimmed = text.trim().replace(",", ".");
      if (trimmed === "") return fallback ?? 0;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : (fallback ?? 0);
    };
    onSave(parse(draft.weight, weight), parse(draft.reps, reps));
    setDraft(null);
  };

  return (
    <View style={styles.editRow}>
      <TextInput
        style={styles.editInput}
        value={draft.weight}
        onChangeText={(v) => setDraft({ ...draft, weight: v })}
        keyboardType="decimal-pad"
        autoFocus
      />
      <Text style={styles.tagX}>×</Text>
      <TextInput
        style={styles.editInput}
        value={draft.reps}
        onChangeText={(v) => setDraft({ ...draft, reps: v })}
        keyboardType="numeric"
      />
      <Pressable onPress={save} style={styles.editIcon} hitSlop={6}>
        <Check size={14} color={COLORS.ACCENT_GREEN} />
      </Pressable>
      <Pressable onPress={() => setDraft(null)} style={styles.editIcon} hitSlop={6}>
        <X size={14} color={COLORS.DANGER} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: SURFACE.blueTint,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: SPACE.sm - 2,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: SURFACE.blueBorder,
  },
  tagText: { ...TYPE.monoSmall, color: COLORS.TEXT_PRIMARY },
  tagX: { ...TYPE.monoSmall, color: COLORS.TEXT_TERTIARY, marginHorizontal: 2 },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm - 2,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_BLUE,
  },
  editInput: {
    ...TYPE.monoSmall,
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
    padding: 0,
    width: 36,
  },
  editIcon: { marginLeft: SPACE.xs, padding: 2 },
});

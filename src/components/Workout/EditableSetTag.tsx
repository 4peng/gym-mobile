import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";

interface EditableSetTagProps {
  weight: number | null;
  reps: number | null;
  onSave: (weight: number, reps: number) => void;
}

/** "100 × 8" chip that flips into an inline weight/reps editor on tap. */
export function EditableSetTag({ weight, reps, onSave }: EditableSetTagProps) {
  const [draft, setDraft] = useState<{ weight: string; reps: string } | null>(null);

  if (!draft) {
    return (
      <Pressable
        style={({ pressed }) => [styles.tag, pressed && { backgroundColor: COLORS.CARD_HOVER }]}
        onPress={() => setDraft({ weight: String(weight ?? 0), reps: String(reps ?? 0) })}
      >
        <Text style={styles.tagText}>
          {weight} <Text style={styles.tagX}>×</Text> {reps}
        </Text>
      </Pressable>
    );
  }

  const save = () => {
    const w = Number(draft.weight.trim().replace(",", "."));
    const r = Number(draft.reps.trim());
    if (Number.isFinite(w) && Number.isFinite(r)) onSave(w, r);
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
      <Pressable onPress={save} style={styles.editIcon}>
        <Check size={14} color={COLORS.ACCENT_GREEN} />
      </Pressable>
      <Pressable onPress={() => setDraft(null)} style={styles.editIcon}>
        <X size={14} color={COLORS.DANGER} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.1)",
  },
  tagText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
  },
  tagX: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    marginHorizontal: 2,
    fontFamily: FONT_FAMILIES.MONO,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_BLUE,
  },
  editInput: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILIES.MONO,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    padding: 0,
    width: 35, // fixed width keeps the text from collapsing while typing
  },
  editIcon: { marginLeft: 4, padding: 2 },
});

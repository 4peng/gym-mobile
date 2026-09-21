import { Alert } from "react-native";

export function showAlert(title: string, message: string) {
  Alert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
) {
  Alert.alert(title, message, [
    { text: "Cancel", onPress: onCancel, style: "cancel" },
    { text: "Confirm", onPress: onConfirm },
  ]);
}

/** Prompts for a YYYY-MM-DD date, prefilled from `currentIso`; calls onSave with the validated string. */
export function promptForDate(currentIso: string, onSave: (yyyyMmDd: string) => void) {
  Alert.prompt(
    "Edit Date",
    "Enter new date (YYYY-MM-DD):",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (value?: string) => {
          if (!value) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            Alert.alert("Invalid format", "Please use YYYY-MM-DD");
            return;
          }
          onSave(value);
        },
      },
    ],
    "plain-text",
    new Date(currentIso).toISOString().split("T")[0],
  );
}

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

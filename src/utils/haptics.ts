import * as Haptics from "expo-haptics";

/** Haptic feedback shorthands. */
export const HapticFeedback = {
  /** Light tap for selection or subtle transitions */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Medium tap for successful actions (e.g. completing a set) */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Heavy tap for primary actions or deletions */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  /** Notification success (e.g. finishing a workout) */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Warning or selection change */
  selection: () => Haptics.selectionAsync(),
};

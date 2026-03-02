import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Universal Haptic feedback utility.
 * Fails gracefully on web/unsupported platforms.
 */
export const HapticFeedback = {
  /** Light tap for selection or subtle transitions */
  light: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /** Medium tap for successful actions (e.g. completing a set) */
  medium: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /** Heavy tap for primary actions or deletions */
  heavy: () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /** Notification success (e.g. finishing a workout) */
  success: () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /** Warning or selection change */
  selection: () => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync();
  }
};

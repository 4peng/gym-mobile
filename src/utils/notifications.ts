import * as Notifications from "expo-notifications";

// ──────────────────────────────────────────────
// Foreground handler
// ──────────────────────────────────────────────

/**
 * Call once at app root mount.
 * Ensures notifications show alert + play sound even when the app
 * is foregrounded.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ──────────────────────────────────────────────
// Permissions (iOS)
// ──────────────────────────────────────────────

/**
 * Request notification permissions gracefully.
 * Returns `true` if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ──────────────────────────────────────────────
// Schedule / Cancel helpers
// ──────────────────────────────────────────────

/**
 * Schedule a local notification that fires after `seconds` from now.
 * Returns the notification identifier (used to cancel later).
 */
export async function scheduleRestCompleteNotification(
  exerciseName: string,
  seconds: number
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Rest Complete",
      body: `${exerciseName} \u2013 start next set`,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
      repeats: false,
    },
  });
  return id;
}

/**
 * Cancel a previously scheduled notification by its identifier.
 * Silently no-ops if the notification was already delivered or invalid.
 */
export async function cancelScheduledNotification(
  notificationId: string
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already delivered or no longer exists — safe to ignore.
  }
}

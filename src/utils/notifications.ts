import * as Notifications from "expo-notifications";

/** Call once at app root: show alert and sound while foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Clears delivered notifications and the badge on activation; scheduled ones stay. */
export async function clearAppNotifications(): Promise<void> {
  try {
    await Promise.all([
      Notifications.dismissAllNotificationsAsync(),
      Notifications.setBadgeCountAsync(0),
    ]);
  } catch (err) {
    console.error("clearAppNotifications error:", err);
  }
}

/** Requests notification permission; true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Schedules a local notification `seconds` from now; returns its id. */
export async function scheduleRestCompleteNotification(
  exerciseName: string,
  seconds: number,
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

/** Cancels a scheduled notification; no-op if already delivered or unknown. */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (err) {
    console.error("cancelScheduledNotification error:", err);
  }
}

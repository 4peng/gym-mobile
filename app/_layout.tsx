import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ActivityIndicator, AppState, View } from "react-native";
import { COLORS, FONT_ASSETS, UI } from "@/constants/theme";
import { workoutRepo } from "@/db";
import { migrateFromAsyncStorage } from "@/db/migrateFromAsyncStorage";
import { startNetworkSyncListener } from "@/lib/api/networkListener";
import { initSyncEffect } from "@/stores/syncEffect";
import {
  clearAppNotifications,
  configureNotificationHandler,
  requestNotificationPermissions,
} from "@/utils/notifications";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Opening the database applies the schema; then pull in any pre-SQLite shards.
    migrateFromAsyncStorage(workoutRepo)
      .catch((err) => console.error("Shard migration failed:", err))
      .finally(() => setDbReady(true));
  }, []);

  useEffect(() => {
    configureNotificationHandler();
    void clearAppNotifications();
    void requestNotificationPermissions();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void clearAppNotifications();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const stopSyncEffect = initSyncEffect();
    const unsubscribe = startNetworkSyncListener();
    return () => {
      unsubscribe();
      stopSyncEffect();
    };
  }, [dbReady]);

  const ready = (fontsLoaded || !!fontError) && dbReady;

  return (
    <GestureHandlerRootView style={UI.screen}>
      {ready ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.BG },
            animation: "fade_from_bottom",
          }}
        >
          <Stack.Screen
            name="exercises/[name]/volume"
            options={{ animation: "slide_from_bottom", gestureEnabled: true }}
          />
        </Stack>
      ) : (
        <View style={[UI.screen, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={COLORS.ACCENT_BLUE} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}

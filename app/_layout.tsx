import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '@/constants/colors';
import { FONT_ASSETS } from '@/constants/fonts';
import { startNetworkSyncListener } from '@/lib/api/networkListener';
import { initSyncEffect } from '@/stores/syncEffect';
import {
  clearAppNotifications,
  configureNotificationHandler,
  requestNotificationPermissions,
} from '@/utils/notifications';


export default function RootLayout() {
  // Pulling configuration directly from fonts.ts
  const [loaded, error] = useFonts(FONT_ASSETS);

  useEffect(() => {
    configureNotificationHandler();
    void clearAppNotifications();
    void requestNotificationPermissions();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void clearAppNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const stopSyncEffect = initSyncEffect();
    const unsubscribe = startNetworkSyncListener();
    return () => {
      unsubscribe();
      stopSyncEffect();
    };
  }, []);

  if (!loaded && !error) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.BG, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.ACCENT_BLUE} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.BG },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="programs" />
        <Stack.Screen name="workout/index" />
        <Stack.Screen
          name="exercises/[name]/volume"
          options={{
            animation: 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="stats/index" />
      </Stack>
    </GestureHandlerRootView>
  );
}

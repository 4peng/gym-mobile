import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Font from 'expo-font';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/src/constants/colors';
import { useState } from 'react';
import { startNetworkSyncListener } from '@/src/lib/api/networkListener';
import { initSyncEffect } from '@/src/stores/syncEffect';

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Break circular dependencies by initializing sync listeners here
    const stopSyncEffect = initSyncEffect();
    
    // Start the network sync listener on mount and cleanup on unmount
    const unsubscribe = startNetworkSyncListener();
    
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'NeueHaasUnicaPro-Medium': require('../assets/fonts/NeueHaasUnicaPro-Medium.ttf'),
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn('Font loading failed, falling back to system fonts:', e);
        setError(e as Error);
        setFontsLoaded(true);
      }
    }

    loadFonts();
    
    return () => {
      unsubscribe();
      stopSyncEffect();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.BG, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.ACCENT_BLUE} />
      </View>
    );
  }

  return (
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
        name="exercises/[name]/index" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }} 
      />
      <Stack.Screen 
        name="exercises/[name]/volume" 
        options={{ 
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }} 
      />
      <Stack.Screen name="stats/index" />
    </Stack>
  );
}

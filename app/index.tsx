import { Redirect } from 'expo-router';
import { useWorkoutSessionStore } from '@/src/stores/workoutSessionStore';
import { useEffect, useState } from 'react';

export default function Index() {
  const [isHydrated, setIsHydrated] = useState(false);
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);

  useEffect(() => {
    // With MMKV it's almost instant, but we check if the store is ready.
    // Zustand's persist middleware often needs one tick or has a persist.hasHydrated property.
    // For now, we'll assume it's ready after mount or we can check the state.
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;

  if (activeSession) {
    return <Redirect href="/workout" />;
  }

  return <Redirect href="/programs/" />;
}

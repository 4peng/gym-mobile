import { useEffect, useMemo } from "react";
import { Platform } from "react-native";

import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import {
  endRestTimerLiveActivity,
  syncRestTimerLiveActivity,
  type RestTimerLiveActivitySnapshot,
} from "@/liveActivities/restTimerLiveActivity";

function getWorkoutTitle(programName?: string | null) {
  const trimmed = programName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Live Workout";
}

export default function RestTimerLiveActivitySync() {
  const activeRestTimer = useWorkoutSessionStore((state) => state.activeRestTimer);
  const activeSession = useWorkoutSessionStore((state) => state.activeSession);
  const programName = useProgramStore((state) =>
    activeSession?.programId
      ? state.programs.find((program) => program._id === activeSession.programId)?.name
      : undefined
  );

  const snapshot = useMemo<RestTimerLiveActivitySnapshot | null>(() => {
    if (!activeRestTimer) {
      return null;
    }

    return {
      title: getWorkoutTitle(programName),
      exerciseName: activeRestTimer.exerciseName,
      endTime: activeRestTimer.endTime,
    };
  }, [activeRestTimer, programName]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    void syncRestTimerLiveActivity(snapshot);
  }, [snapshot]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !activeRestTimer) {
      return;
    }

    const interval = setInterval(() => {
      const currentTimer = useWorkoutSessionStore.getState().activeRestTimer;
      const currentSession = useWorkoutSessionStore.getState().activeSession;
      const currentProgramName = currentSession?.programId
        ? useProgramStore.getState().getProgramById(currentSession.programId)?.name
        : undefined;

      if (!currentTimer) {
        void endRestTimerLiveActivity();
        return;
      }

      void syncRestTimerLiveActivity({
        title: getWorkoutTitle(currentProgramName),
        exerciseName: currentTimer.exerciseName,
        endTime: currentTimer.endTime,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRestTimer]);

  return null;
}

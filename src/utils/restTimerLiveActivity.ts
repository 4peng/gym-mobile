import { Platform } from "react-native";
import type { WorkoutSession } from "@/types";

export type RestTimerLiveActivityProps = {
  exerciseName: string;
  workoutStartedAt: number;
  restStartedAt: number;
  restEndsAt: number;
  restDurationSeconds: number;
  setsCompleted: number;
  setsTotal: number;
};

type RestTimerSnapshot = {
  exerciseName: string;
  startTime: number;
  endTime: number;
};

function getSetProgress(session: WorkoutSession | null) {
  if (!session) {
    return { setsCompleted: 0, setsTotal: 0 };
  }

  return session.exercises.reduce(
    (progress, exercise) => {
      progress.setsTotal += exercise.sets.length;
      progress.setsCompleted += exercise.sets.filter((set) => !!set.completedAt).length;
      return progress;
    },
    { setsCompleted: 0, setsTotal: 0 }
  );
}

export function buildRestTimerLiveActivityProps(
  session: WorkoutSession | null,
  exerciseName: string,
  restStartedAt: number,
  restEndsAt: number,
  restDurationSeconds: number
): RestTimerLiveActivityProps | null {
  if (!session) return null;

  const workoutStartedAt = new Date(session.startedAt).getTime();
  if (!Number.isFinite(workoutStartedAt)) return null;

  return {
    exerciseName,
    workoutStartedAt,
    restStartedAt,
    restEndsAt,
    restDurationSeconds,
    ...getSetProgress(session),
  };
}

export function buildActiveRestTimerLiveActivityProps(
  session: WorkoutSession | null,
  timer: RestTimerSnapshot | null
) {
  if (!timer) return null;

  return buildRestTimerLiveActivityProps(
    session,
    timer.exerciseName,
    timer.startTime,
    timer.endTime,
    Math.round((timer.endTime - timer.startTime) / 1000)
  );
}

async function getRestTimerActivity() {
  if (Platform.OS !== "ios") return null;

  try {
    const module = await import("@/widgets/RestTimerLiveActivity");
    return module.default;
  } catch {
    return null;
  }
}

export async function startRestTimerLiveActivity(
  props: RestTimerLiveActivityProps | null
) {
  if (!props) return;

  const activity = await getRestTimerActivity();
  if (!activity) return;

  try {
    for (const instance of activity.getInstances()) {
      await instance.end("immediate", props, new Date());
    }
    activity.start(props, "gym-mobile://workout");
  } catch {
    // Live Activities are best-effort; the in-app timer and local notification remain canonical.
  }
}

export async function updateRestTimerLiveActivity(
  props: RestTimerLiveActivityProps | null
) {
  if (!props) return;

  const activity = await getRestTimerActivity();
  if (!activity) return;

  try {
    const [instance] = activity.getInstances();
    if (instance) {
      await instance.update(props);
    }
  } catch {
    // Best-effort native surface.
  }
}

export async function endRestTimerLiveActivity(
  props?: RestTimerLiveActivityProps | null
) {
  const activity = await getRestTimerActivity();
  if (!activity) return;

  try {
    for (const instance of activity.getInstances()) {
      await instance.end("immediate", props ?? undefined, new Date());
    }
  } catch {
    // Best-effort native surface.
  }
}

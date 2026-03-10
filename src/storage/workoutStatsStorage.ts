import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSession } from "@/types";

export const WORKOUT_STATS_KEY = "workout-stats-index-v1";

interface Aggregate {
  volume: number;
  sets: number;
  reps: number;
  lastUpdated: number;
}

interface SessionContribution {
  sessionId: string;
  dateKey: string;
  total: Aggregate;
  byExercise: Record<string, Aggregate>;
}

export interface WorkoutStatsIndex {
  version: 1;
  sessions: Record<string, SessionContribution>;
  daily: Record<string, Aggregate>;
  exercises: Record<string, Aggregate>;
  updatedAt: number;
}

const emptyAggregate = (): Aggregate => ({
  volume: 0,
  sets: 0,
  reps: 0,
  lastUpdated: Date.now(),
});

const emptyIndex = (): WorkoutStatsIndex => ({
  version: 1,
  sessions: {},
  daily: {},
  exercises: {},
  updatedAt: Date.now(),
});

const clamp = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

const toDateKey = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
};

const normalizeExerciseKey = (name: string) => name.trim().toLowerCase();

function addAgg(target: Aggregate, source: Aggregate) {
  target.volume = clamp(target.volume + source.volume);
  target.sets = clamp(target.sets + source.sets);
  target.reps = clamp(target.reps + source.reps);
  target.lastUpdated = Date.now();
}

function subAgg(target: Aggregate, source: Aggregate) {
  target.volume = clamp(target.volume - source.volume);
  target.sets = clamp(target.sets - source.sets);
  target.reps = clamp(target.reps - source.reps);
  target.lastUpdated = Date.now();
}

function isZeroAgg(agg: Aggregate) {
  return agg.volume <= 0 && agg.sets <= 0 && agg.reps <= 0;
}

function computeContribution(session: WorkoutSession): SessionContribution | null {
  if (session.deletedAt || !session.completedAt) return null;

  const byExercise: Record<string, Aggregate> = {};
  const total = emptyAggregate();

  for (const exercise of session.exercises) {
    const key = normalizeExerciseKey(exercise.name || "");
    if (!key) continue;

    let exerciseVolume = 0;
    let exerciseSets = 0;
    let exerciseReps = 0;

    for (const set of exercise.sets) {
      if (!set.completedAt) continue;
      if (set.weight == null || set.reps == null) continue;
      if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) continue;

      exerciseSets += 1;
      exerciseReps += set.reps;
      exerciseVolume += set.weight * set.reps;
    }

    if (exerciseSets === 0) continue;

    if (!byExercise[key]) byExercise[key] = emptyAggregate();
    byExercise[key].volume += exerciseVolume;
    byExercise[key].sets += exerciseSets;
    byExercise[key].reps += exerciseReps;
    byExercise[key].lastUpdated = Date.now();

    total.volume += exerciseVolume;
    total.sets += exerciseSets;
    total.reps += exerciseReps;
    total.lastUpdated = Date.now();
  }

  if (total.sets === 0) return null;

  return {
    sessionId: session._id,
    dateKey: toDateKey(session.completedAt || session.startedAt),
    total,
    byExercise,
  };
}

function applyContribution(index: WorkoutStatsIndex, contribution: SessionContribution) {
  if (!index.daily[contribution.dateKey]) index.daily[contribution.dateKey] = emptyAggregate();
  addAgg(index.daily[contribution.dateKey], contribution.total);

  for (const [exerciseKey, agg] of Object.entries(contribution.byExercise)) {
    if (!index.exercises[exerciseKey]) index.exercises[exerciseKey] = emptyAggregate();
    addAgg(index.exercises[exerciseKey], agg);
  }
}

function removeContribution(index: WorkoutStatsIndex, contribution: SessionContribution) {
  const dayAgg = index.daily[contribution.dateKey];
  if (dayAgg) {
    subAgg(dayAgg, contribution.total);
    if (isZeroAgg(dayAgg)) delete index.daily[contribution.dateKey];
  }

  for (const [exerciseKey, agg] of Object.entries(contribution.byExercise)) {
    const exAgg = index.exercises[exerciseKey];
    if (!exAgg) continue;
    subAgg(exAgg, agg);
    if (isZeroAgg(exAgg)) delete index.exercises[exerciseKey];
  }
}

async function loadIndex(): Promise<WorkoutStatsIndex> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_STATS_KEY);
    if (!raw) return emptyIndex();
    const parsed = JSON.parse(raw) as WorkoutStatsIndex;
    if (!parsed || parsed.version !== 1) return emptyIndex();
    return parsed;
  } catch {
    return emptyIndex();
  }
}

async function saveIndex(index: WorkoutStatsIndex) {
  index.updatedAt = Date.now();
  await AsyncStorage.setItem(WORKOUT_STATS_KEY, JSON.stringify(index));
}

export const workoutStatsStorage = {
  async getIndex(): Promise<WorkoutStatsIndex> {
    return loadIndex();
  },

  async upsertSession(session: WorkoutSession): Promise<void> {
    const index = await loadIndex();
    const existing = index.sessions[session._id];
    if (existing) {
      removeContribution(index, existing);
      delete index.sessions[session._id];
    }

    const next = computeContribution(session);
    if (next) {
      index.sessions[session._id] = next;
      applyContribution(index, next);
    }

    await saveIndex(index);
  },

  async upsertBatch(sessions: WorkoutSession[]): Promise<void> {
    if (sessions.length === 0) return;
    const index = await loadIndex();

    for (const session of sessions) {
      const existing = index.sessions[session._id];
      if (existing) {
        removeContribution(index, existing);
        delete index.sessions[session._id];
      }

      const next = computeContribution(session);
      if (next) {
        index.sessions[session._id] = next;
        applyContribution(index, next);
      }
    }

    await saveIndex(index);
  },

  async removeSessions(sessionIds: string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    const index = await loadIndex();

    for (const id of sessionIds) {
      const existing = index.sessions[id];
      if (!existing) continue;
      removeContribution(index, existing);
      delete index.sessions[id];
    }

    await saveIndex(index);
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(WORKOUT_STATS_KEY);
  },
};

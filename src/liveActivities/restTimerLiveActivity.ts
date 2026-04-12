import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import type { LiveActivity, LiveActivityFactory } from "expo-widgets";

import type { RestTimerActivityProps } from "@/liveActivities/RestTimerActivity";

export type RestTimerLiveActivitySnapshot = {
  title: string;
  exerciseName: string;
  endTime: number;
};

let activityFactoryPromise: Promise<LiveActivityFactory<RestTimerActivityProps> | null> | null = null;
let currentActivity: LiveActivity<RestTimerActivityProps> | null = null;
let lastPropsSignature: string | null = null;
let warnedUnavailable = false;

function canUseLiveActivities() {
  return (
    Platform.OS === "ios" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

function formatRemainingLabel(endTime: number) {
  const totalSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildProps(snapshot: RestTimerLiveActivitySnapshot): RestTimerActivityProps {
  return {
    title: snapshot.title,
    exerciseName: snapshot.exerciseName,
    endTime: snapshot.endTime,
    remainingLabel: formatRemainingLabel(snapshot.endTime),
  };
}

async function getActivityFactory() {
  if (!canUseLiveActivities()) {
    return null;
  }

  if (!activityFactoryPromise) {
    activityFactoryPromise = import("./RestTimerActivity")
      .then((module) => module.default)
      .catch((error) => {
        if (!warnedUnavailable) {
          console.warn("Rest timer Live Activity is unavailable in this build.", error);
          warnedUnavailable = true;
        }
        return null;
      });
  }

  return activityFactoryPromise;
}

async function adoptExistingActivity(factory: LiveActivityFactory<RestTimerActivityProps>) {
  const instances = factory.getInstances();

  currentActivity = instances[0] ?? null;

  if (instances.length > 1) {
    await Promise.all(
      instances.slice(1).map((instance) => instance.end("immediate").catch(() => undefined))
    );
  }
}

export async function endRestTimerLiveActivity() {
  const factory = await getActivityFactory();
  if (!factory) return;

  const instances = factory.getInstances();
  await Promise.all(instances.map((instance) => instance.end("immediate").catch(() => undefined)));

  currentActivity = null;
  lastPropsSignature = null;
}

export async function syncRestTimerLiveActivity(
  snapshot: RestTimerLiveActivitySnapshot | null
) {
  const factory = await getActivityFactory();
  if (!factory) return;

  if (!snapshot || snapshot.endTime <= Date.now()) {
    await endRestTimerLiveActivity();
    return;
  }

  if (!currentActivity) {
    await adoptExistingActivity(factory);
  }

  const props = buildProps(snapshot);
  const signature = JSON.stringify(props);

  if (!currentActivity) {
    currentActivity = factory.start(props, "gym-mobile://workout");
    lastPropsSignature = signature;
    return;
  }

  if (signature === lastPropsSignature) {
    return;
  }

  await currentActivity.update(props);
  lastPropsSignature = signature;
}

import React from "react";
import { createLiveActivity, type LiveActivityComponent } from "expo-widgets";
import { HStack, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";
import type { RestTimerLiveActivityProps } from "@/utils/restTimerLiveActivity";

const RestTimerLayout: LiveActivityComponent<RestTimerLiveActivityProps> = (props) => {
  "widget";

  const bg = "#000000";
  const text = "#F7F7F7";
  const secondary = "#8E8E93";
  const yellow = "#FFCC00";
  const blue = "#007AFF";
  const timerInterval = {
    lower: new Date(props.restStartedAt),
    upper: new Date(props.restEndsAt),
  };
  const elapsedInterval = {
    lower: new Date(props.workoutStartedAt),
    upper: new Date(props.restEndsAt),
  };
  const setsText = `${props.setsCompleted}/${Math.max(props.setsTotal, 1)}`;

  const RestBlock = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[foregroundStyle(yellow), font({ size: 11, weight: "bold", design: "monospaced" })]}>
        REST
      </Text>
      <Text
        timerInterval={timerInterval}
        countsDown
        modifiers={[
          foregroundStyle(text),
          font({ size: 34, weight: "bold", design: "monospaced" }),
          monospacedDigit(),
        ]}
      />
    </VStack>
  );

  const SetsBlock = (
    <VStack alignment="trailing" spacing={2}>
      <Text modifiers={[foregroundStyle(blue), font({ size: 11, weight: "bold", design: "monospaced" })]}>
        SETS
      </Text>
      <Text
        modifiers={[
          foregroundStyle(text),
          font({ size: 34, weight: "bold", design: "monospaced" }),
          monospacedDigit(),
        ]}
      >
        {setsText}
      </Text>
    </VStack>
  );

  const Banner = (
    <VStack
      spacing={12}
      modifiers={[
        background(bg),
        padding({ horizontal: 18, vertical: 14 }),
        clipShape("roundedRectangle", 28),
      ]}
    >
      <HStack alignment="center" spacing={12}>
        {RestBlock}
        <Spacer />
        <VStack alignment="center" spacing={3}>
          <Text
            modifiers={[
              foregroundStyle(secondary),
              font({ size: 12, weight: "semibold", design: "monospaced" }),
              lineLimit(1),
              truncationMode("tail"),
            ]}
          >
            ONGOING
          </Text>
          <Text
            modifiers={[
              foregroundStyle(secondary),
              font({ size: 11, weight: "medium", design: "monospaced" }),
              lineLimit(1),
              truncationMode("tail"),
            ]}
          >
            {props.exerciseName}
          </Text>
        </VStack>
        <Spacer />
        {SetsBlock}
      </HStack>

      <ProgressView
        timerInterval={timerInterval}
        countsDown={false}
        modifiers={[
          progressViewStyle("linear"),
          tint(blue),
          frame({ height: 10 }),
          clipShape("roundedRectangle", 5),
        ]}
      />

      <HStack alignment="center" spacing={10}>
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[foregroundStyle(secondary), font({ size: 12, weight: "medium", design: "monospaced" })]}>
            Started
          </Text>
          <Text modifiers={[foregroundStyle(secondary), font({ size: 12, weight: "medium", design: "monospaced" })]}>
            Elapsed
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={1}>
          <Text
            date={new Date(props.workoutStartedAt)}
            dateStyle="time"
            modifiers={[foregroundStyle(secondary), font({ size: 12, weight: "medium", design: "monospaced" })]}
          />
          <Text
            timerInterval={elapsedInterval}
            countsDown={false}
            modifiers={[
              foregroundStyle(secondary),
              font({ size: 12, weight: "medium", design: "monospaced" }),
              monospacedDigit(),
            ]}
          />
        </VStack>
      </HStack>
    </VStack>
  );

  return {
    banner: Banner,
    bannerSmall: Banner,
    compactLeading: (
      <Text
        timerInterval={timerInterval}
        countsDown
        modifiers={[foregroundStyle(yellow), font({ size: 15, weight: "bold", design: "monospaced" }), monospacedDigit()]}
      />
    ),
    compactTrailing: (
      <Text modifiers={[foregroundStyle(text), font({ size: 15, weight: "bold", design: "monospaced" }), monospacedDigit()]}>
        {setsText}
      </Text>
    ),
    minimal: (
      <Text
        timerInterval={timerInterval}
        countsDown
        modifiers={[foregroundStyle(yellow), font({ size: 11, weight: "bold", design: "monospaced" }), monospacedDigit()]}
      />
    ),
    expandedLeading: RestBlock,
    expandedTrailing: SetsBlock,
    expandedCenter: (
      <Text modifiers={[foregroundStyle(secondary), font({ size: 12, weight: "semibold", design: "monospaced" }), lineLimit(1)]}>
        ONGOING
      </Text>
    ),
    expandedBottom: (
      <ProgressView
        timerInterval={timerInterval}
        countsDown={false}
        modifiers={[progressViewStyle("linear"), tint(blue), frame({ height: 8 }), clipShape("roundedRectangle", 4)]}
      />
    ),
  };
};

const RestTimerLiveActivity = createLiveActivity<RestTimerLiveActivityProps>(
  "RestTimerLiveActivity",
  RestTimerLayout
);

export default RestTimerLiveActivity;

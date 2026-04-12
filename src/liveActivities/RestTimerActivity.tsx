import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { cornerRadius, font, foregroundStyle, opacity, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

export type RestTimerActivityProps = {
  title: string;
  exerciseName: string;
  remainingLabel: string;
  endTime: number;
};

function RestTimerActivity(
  props: RestTimerActivityProps,
  environment: { colorScheme: "light" | "dark" }
) {
  "widget";

  const accentColor = environment.colorScheme === "dark" ? "#0A84FF" : "#0b82ff";
  const secondaryText = environment.colorScheme === "dark" ? "#A1A1AA" : "#5F6368";
  const progressUpper = new Date(Math.max(props.endTime, Date.now() + 1000));
  const progressLower = new Date();

  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(secondaryText)]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: 18, weight: "bold" }), padding({ top: 2 })]}>
          Rest
        </Text>
        <HStack modifiers={[padding({ top: 8 })]}>
          <VStack>
            <Text
              modifiers={[
                font({ size: 28, weight: "bold", design: "monospaced" }),
                foregroundStyle(accentColor),
              ]}
            >
              {props.remainingLabel}
            </Text>
            <Text modifiers={[font({ size: 13 }), foregroundStyle(secondaryText)]}>
              {props.exerciseName}
            </Text>
          </VStack>
          <Spacer />
        </HStack>
        <ProgressView
          timerInterval={{ lower: progressLower, upper: progressUpper }}
          countsDown
          modifiers={[padding({ top: 10 }), foregroundStyle(accentColor)]}
        />
      </VStack>
    ),
    compactLeading: (
      <Image
        systemName="figure.strengthtraining.traditional"
        color={accentColor}
        size={18}
      />
    ),
    compactTrailing: (
      <Text
        modifiers={[
          font({ size: 14, weight: "bold", design: "monospaced" }),
          foregroundStyle(accentColor),
        ]}
      >
        {props.remainingLabel}
      </Text>
    ),
    minimal: (
      <Text
        modifiers={[
          font({ size: 12, weight: "bold", design: "monospaced" }),
          foregroundStyle(accentColor),
        ]}
      >
        {props.remainingLabel}
      </Text>
    ),
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(secondaryText)]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: 16, weight: "bold" }), padding({ top: 4 })]}>Rest</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(secondaryText), padding({ top: 2 })]}>
          {props.exerciseName}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text
          modifiers={[
            font({ size: 26, weight: "bold", design: "monospaced" }),
            foregroundStyle(accentColor),
          ]}
        >
          {props.remainingLabel}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ leading: 12, trailing: 12, bottom: 12 })]}>
        <ProgressView
          timerInterval={{ lower: progressLower, upper: progressUpper }}
          countsDown
          modifiers={[
            foregroundStyle(accentColor),
            opacity(0.95),
            cornerRadius(999),
          ]}
        />
      </VStack>
    ),
  };
}

export default createLiveActivity("RestTimerActivity", RestTimerActivity);

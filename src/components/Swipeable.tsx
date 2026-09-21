import React, { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Pin, Trash2 } from "lucide-react-native";
import { COLORS, LAYOUT, RADIUS, SPACE, UI } from "@/constants/theme";
import { HapticFeedback } from "@/utils/haptics";

const BUTTON_WIDTH = 64;
const REVEAL_THRESHOLD = 25;
const INSTANT_DELETE_THRESHOLD = LAYOUT.screenWidth * 0.6;
const SECONDARY_DELETE_THRESHOLD = BUTTON_WIDTH + 80;
const SPRING = {
  useNativeDriver: true,
  tension: 50,
  friction: 12,
  restSpeedThreshold: 0.1,
  restDisplacementThreshold: 0.1,
};

interface SwipeableProps {
  children: React.ReactNode;
  /** Swipe left reveals delete; a long swipe deletes immediately. Omit to disable. */
  onDelete?: () => void;
  /** Swipe right reveals pin. Omit to disable. */
  onPin?: () => void;
  /** Let the parent list disable scrolling while a swipe is in progress. */
  onToggleScroll?: (enabled: boolean) => void;
  borderRadius?: number;
  marginBottom?: number;
}

/** Row wrapper with swipe-to-delete (left) and swipe-to-pin (right). */
export const Swipeable = ({
  children,
  onDelete,
  onPin,
  onToggleScroll,
  borderRadius = RADIUS.container,
  marginBottom = SPACE.lg,
}: SwipeableProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const gestureStartOffset = useRef(0);
  const wasOpenAtStart = useRef(false);
  const hapticTriggered = useRef(false);

  // Latest-value refs: the responder is created once but must call current props.
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onToggleScrollRef = useRef(onToggleScroll);
  onToggleScrollRef.current = onToggleScroll;

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      lastOffset.current = value;
      const abs = Math.abs(value);
      if (abs > REVEAL_THRESHOLD && !hapticTriggered.current) {
        HapticFeedback.light();
        hapticTriggered.current = true;
      } else if (abs < REVEAL_THRESHOLD && hapticTriggered.current) {
        hapticTriggered.current = false;
      }
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  const spring = (toValue: number, velocity?: number) =>
    Animated.spring(translateX, { toValue, velocity, ...SPRING }).start();

  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        const alreadyOpen = Math.abs(lastOffset.current) > 5;
        const allowed =
          alreadyOpen || (!!onDeleteRef.current && dx < -12) || (!!onPinRef.current && dx > 12);
        return allowed && Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 12;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
        gestureStartOffset.current = lastOffset.current;
        wasOpenAtStart.current = Math.abs(gestureStartOffset.current) > REVEAL_THRESHOLD;
        onToggleScrollRef.current?.(false);
        translateX.setOffset(gestureStartOffset.current);
        translateX.setValue(0);
        hapticTriggered.current = wasOpenAtStart.current;
      },
      onPanResponderMove: (_, { dx }) => {
        const total = gestureStartOffset.current + dx;
        let next = total;
        if (total > 0) {
          if (!onPinRef.current)
            next = Math.pow(total, 0.4); // resistance
          else if (total > BUTTON_WIDTH) next = BUTTON_WIDTH + (total - BUTTON_WIDTH) * 0.5;
        } else if (total < -BUTTON_WIDTH) {
          next = -BUTTON_WIDTH + (total + BUTTON_WIDTH) * 0.5;
        }
        translateX.setValue(next - gestureStartOffset.current);
      },
      onPanResponderRelease: (_, { vx }) => {
        onToggleScrollRef.current?.(true);
        translateX.flattenOffset();
        const value = lastOffset.current;

        if (value > 5 && onPinRef.current) {
          spring(vx > 0.3 || (value > REVEAL_THRESHOLD && vx >= -0.3) ? BUTTON_WIDTH : 0, vx);
          return;
        }

        const threshold =
          wasOpenAtStart.current && value < 0
            ? SECONDARY_DELETE_THRESHOLD
            : INSTANT_DELETE_THRESHOLD;
        if (value < -threshold) {
          HapticFeedback.heavy();
          Animated.timing(translateX, {
            toValue: -LAYOUT.screenWidth,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDeleteRef.current?.();
            translateX.setValue(0);
          });
          return;
        }
        spring(vx < -0.3 || (value < -REVEAL_THRESHOLD && vx <= 0.3) ? -BUTTON_WIDTH : 0, vx);
      },
      onPanResponderTerminate: () => {
        onToggleScrollRef.current?.(true);
        translateX.flattenOffset();
        const value = lastOffset.current;
        spring(
          value < -REVEAL_THRESHOLD ? -BUTTON_WIDTH : value > REVEAL_THRESHOLD ? BUTTON_WIDTH : 0,
        );
      },
      onShouldBlockNativeResponder: () => true,
    });
  }

  const close = (after: () => void) =>
    Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start(after);
  const pinOpacity = translateX.interpolate({
    inputRange: [0, BUTTON_WIDTH],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const deleteOpacity = translateX.interpolate({
    inputRange: [-BUTTON_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.container, { borderRadius, marginBottom }]}>
      <View style={[UI.fill, { borderRadius, overflow: "hidden" }]}>
        {onPin ? (
          <Animated.View
            style={[
              UI.fill,
              styles.action,
              {
                backgroundColor: COLORS.ACCENT_BLUE,
                opacity: pinOpacity,
                justifyContent: "flex-start",
                borderRadius,
              },
            ]}
          >
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                HapticFeedback.medium();
                close(() => onPin());
              }}
            >
              <Pin size={22} color={COLORS.TEXT_PRIMARY} />
            </Pressable>
          </Animated.View>
        ) : null}
        {onDelete ? (
          <Animated.View
            style={[
              UI.fill,
              styles.action,
              {
                backgroundColor: COLORS.DANGER,
                opacity: deleteOpacity,
                justifyContent: "flex-end",
                borderRadius,
              },
            ]}
          >
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                HapticFeedback.heavy();
                close(() => onDelete());
              }}
            >
              <Trash2 size={22} color={COLORS.TEXT_PRIMARY} />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...responder.current.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: "relative", overflow: "hidden" },
  action: { flexDirection: "row", alignItems: "center" },
  actionButton: {
    width: BUTTON_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});

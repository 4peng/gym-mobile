import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  Pressable,
  Dimensions,
} from 'react-native';
import { Trash2, Pin } from 'lucide-react-native';
import { COLORS } from '@/src/constants/colors';
import { HapticFeedback } from '@/src/utils/haptics';
import { UI } from '@/constants/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_WIDTH = 64;
const REVEAL_THRESHOLD = 25; 
const INSTANT_DELETE_THRESHOLD = SCREEN_WIDTH * 0.6; 
const SECONDARY_DELETE_THRESHOLD = BUTTON_WIDTH + 80;

interface SwipeableProps {
  children: React.ReactNode;
  onDelete: () => void;
  onPin?: () => void;
  onToggleScroll?: (enabled: boolean) => void;
  borderRadius?: number;
  marginBottom?: number;
}

export const Swipeable = ({ 
  children, 
  onDelete, 
  onPin, 
  onToggleScroll,
  borderRadius = UI.RADIUS_HUD,
  marginBottom = 16
}: SwipeableProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const gestureStartOffset = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const wasOpenAtStart = useRef(false);
  const hapticTriggered = useRef(false);

  // Latest-value refs so the PanResponder (created once below) always reads
  // the current props instead of closing over whatever was passed on mount.
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onToggleScrollRef = useRef(onToggleScroll);
  onToggleScrollRef.current = onToggleScroll;

  useEffect(() => {
    const listenerId = translateX.addListener(({ value }) => {
      lastOffset.current = value;
      
      // Haptic when crossing reveal threshold
      const absValue = Math.abs(value);
      if (absValue > REVEAL_THRESHOLD && !hapticTriggered.current) {
        HapticFeedback.light();
        hapticTriggered.current = true;
      } else if (absValue < REVEAL_THRESHOLD && hapticTriggered.current) {
        hapticTriggered.current = false;
      }
    });
    return () => translateX.removeListener(listenerId);
  }, [translateX]);

  const panResponderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const isAlreadyOpen = Math.abs(lastOffset.current) > 5;
        const isCorrectDirection = isAlreadyOpen ? true : (dx < -12 || (!!onPinRef.current && dx > 12));
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * 2;
        const reachedThreshold = Math.abs(dx) > 12;
        return isHorizontal && reachedThreshold && isCorrectDirection;
      },

      onPanResponderGrant: () => {
        translateX.stopAnimation();
        gestureStartOffset.current = lastOffset.current;
        wasOpenAtStart.current = Math.abs(gestureStartOffset.current) > REVEAL_THRESHOLD;
        onToggleScrollRef.current?.(false);
        translateX.setOffset(gestureStartOffset.current);
        translateX.setValue(0);
        hapticTriggered.current = Math.abs(gestureStartOffset.current) > REVEAL_THRESHOLD;
      },

      onPanResponderMove: (_, gestureState) => {
        const { dx } = gestureState;
        const rawTotal = gestureStartOffset.current + dx;

        if (rawTotal > 0) {
          if (!onPinRef.current) {
             const resistance = Math.pow(rawTotal, 0.4);
             translateX.setValue(resistance - gestureStartOffset.current);
             return;
          }
          let finalValue = rawTotal;
          if (rawTotal > BUTTON_WIDTH) {
            const overflow = rawTotal - BUTTON_WIDTH;
            finalValue = BUTTON_WIDTH + (overflow * 0.5);
          }
          translateX.setValue(finalValue - gestureStartOffset.current);
          return;
        }

        let finalValue = rawTotal;
        if (rawTotal < -BUTTON_WIDTH) {
          const overflow = rawTotal + BUTTON_WIDTH;
          finalValue = -BUTTON_WIDTH + (overflow * 0.5); 
        }
        translateX.setValue(finalValue - gestureStartOffset.current);
      },

      onPanResponderRelease: (_, gestureState) => {
        const { vx } = gestureState;
        onToggleScrollRef.current?.(true);
        translateX.flattenOffset();
        const finalValue = lastOffset.current;

        if (finalValue > 5 && onPinRef.current) {
           const isFlickRight = vx > 0.3;
           const isFlickLeft = vx < -0.3;
           const isPastReveal = finalValue > REVEAL_THRESHOLD;
           if (isFlickRight || (isPastReveal && !isFlickLeft)) {
              Animated.spring(translateX, { toValue: BUTTON_WIDTH, useNativeDriver: true, velocity: vx, tension: 50, friction: 12 }).start(() => setIsOpen(true));
           } else {
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true, velocity: vx, tension: 50, friction: 12 }).start(() => setIsOpen(false));
           }
           return;
        }

        const threshold = wasOpenAtStart.current && lastOffset.current < 0 ? SECONDARY_DELETE_THRESHOLD : INSTANT_DELETE_THRESHOLD;
        if (finalValue < -threshold) {
          HapticFeedback.heavy();
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
            onDeleteRef.current();
            translateX.setValue(0);
            setIsOpen(false);
          });
          return;
        }

        const isFlickLeft = vx < -0.3;
        const isFlickRight = vx > 0.3;
        const isPastReveal = finalValue < -REVEAL_THRESHOLD;
        if (isFlickLeft || (isPastReveal && !isFlickRight)) {
          Animated.spring(translateX, { toValue: -BUTTON_WIDTH, useNativeDriver: true, velocity: vx, tension: 50, friction: 12, restSpeedThreshold: 0.1, restDisplacementThreshold: 0.1 }).start(() => setIsOpen(true));
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, velocity: vx, tension: 50, friction: 12, restSpeedThreshold: 0.1, restDisplacementThreshold: 0.1 }).start(() => setIsOpen(false));
        }
      },

      onPanResponderTerminate: () => {
        onToggleScrollRef.current?.(true);
        translateX.flattenOffset();
        const finalValue = lastOffset.current;
        const shouldBeOpenLeft = finalValue < -REVEAL_THRESHOLD;
        const shouldBeOpenRight = finalValue > REVEAL_THRESHOLD;
        const toValue = shouldBeOpenLeft ? -BUTTON_WIDTH : (shouldBeOpenRight ? BUTTON_WIDTH : 0);
        Animated.spring(translateX, { toValue, useNativeDriver: true, tension: 50, friction: 12 }).start(() => setIsOpen(shouldBeOpenLeft || shouldBeOpenRight));
      },
      onShouldBlockNativeResponder: () => true,
    });
  }
  const panResponder = panResponderRef.current;

  const handleDelete = () => {
    HapticFeedback.heavy();
    Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setIsOpen(false);
      onDelete();
    });
  };

  const handlePinAction = () => {
    HapticFeedback.medium();
    Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setIsOpen(false);
      onPin?.();
    });
  };

  const pinOpacity = translateX.interpolate({
    inputRange: [0, BUTTON_WIDTH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const deleteOpacity = translateX.interpolate({
    inputRange: [-BUTTON_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { borderRadius, marginBottom }]}>
      <View style={[styles.backgroundContainer, { borderRadius }]}>
        <Animated.View style={[styles.actionBackground, { backgroundColor: COLORS.ACCENT_BLUE, opacity: pinOpacity, justifyContent: 'flex-start', borderRadius }]}>
          <Pressable style={styles.actionButton} onPress={handlePinAction}>
            <Pin size={22} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.actionBackground, { backgroundColor: COLORS.DANGER, opacity: deleteOpacity, justifyContent: 'flex-end', borderRadius }]}>
          <Pressable style={styles.actionButton} onPress={handleDelete}>
            <Trash2 size={22} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.content, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  actionBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: BUTTON_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
});

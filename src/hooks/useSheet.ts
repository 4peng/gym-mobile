import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder } from "react-native";
import { MOTION } from "@/constants/theme";

/** Open/close animation for sheets; `progress` runs 0 to 1 and stays mounted until closed. */
export function useSheet(visible: boolean) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: MOTION.base,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  return { mounted, progress };
}

/** Drag-down-to-dismiss for a sheet. Spread `panHandlers` on the sheet and add `dragOffset` to its translateY. */
export function useDragToClose(onClose: () => void) {
  const dragOffset = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const responder = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responder.current) {
    responder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragOffset.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 150) onCloseRef.current();
        Animated.spring(dragOffset, { toValue: 0, useNativeDriver: true }).start();
      },
    });
  }

  return { dragOffset, panHandlers: responder.current.panHandlers };
}

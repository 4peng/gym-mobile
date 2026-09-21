import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder } from "react-native";

const SHEET_MS = 180;

/**
 * Open/close plumbing for absolute-positioned sheets (the app never uses a
 * native Modal). Keeps the sheet mounted until the close animation finishes.
 * `progress` runs 0 → 1 on open; interpolate it for backdrop opacity / translateY.
 */
export function useSheet(visible: boolean) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: SHEET_MS,
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
  // Latest-value ref so the responder (created once) always calls the current onClose.
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

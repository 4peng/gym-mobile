import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";

const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const MINUTES = Array.from({ length: 21 }, (_, i) => i);
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5);

interface RestTimerPickerProps {
  visible: boolean;
  initialSeconds: number;
  onClose: () => void;
  onSave: (seconds: number) => void;
}

function selectionFor(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minute = Math.min(Math.floor(safe / 60), MINUTES[MINUTES.length - 1]);
  const second = Math.min(Math.round((safe % 60) / 5) * 5, SECONDS[SECONDS.length - 1]);
  return {
    minute,
    second,
    minuteIndex: MINUTES.indexOf(minute),
    secondIndex: SECONDS.indexOf(second),
  };
}

/** Two-wheel minutes:seconds picker for an exercise's rest time. */
export default function RestTimerPicker({
  visible,
  initialSeconds,
  onClose,
  onSave,
}: RestTimerPickerProps) {
  const initial = selectionFor(initialSeconds);
  const [minute, setMinute] = useState(initial.minute);
  const [second, setSecond] = useState(initial.second);
  const minRef = useRef<FlatList<number>>(null);
  const secRef = useRef<FlatList<number>>(null);
  const settling = useRef(false);

  useEffect(() => {
    if (!visible) return;
    const sel = selectionFor(initialSeconds);
    setMinute(sel.minute);
    setSecond(sel.second);
    settling.current = true;
    const frame = requestAnimationFrame(() => {
      minRef.current?.scrollToOffset({ offset: sel.minuteIndex * ITEM_HEIGHT, animated: false });
      secRef.current?.scrollToOffset({ offset: sel.secondIndex * ITEM_HEIGHT, animated: false });
    });
    const done = setTimeout(() => (settling.current = false), 80);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
      settling.current = false;
    };
  }, [visible, initialSeconds]);

  const onWheel =
    (values: number[], set: (v: number) => void) =>
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (settling.current) return;
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      if (index >= 0 && index < values.length) set(values[index]);
    };

  const renderItem: ListRenderItem<number> = ({ item }) => (
    <View style={styles.item}>
      <Text style={TYPE.monoLarge}>{String(item).padStart(2, "0")}</Text>
    </View>
  );

  const wheel = (
    ref: React.RefObject<FlatList<number> | null>,
    values: number[],
    label: string,
    set: (v: number) => void,
  ) => (
    <View style={styles.column}>
      <Text style={[TYPE.label, styles.columnLabel]}>{label}</Text>
      <FlatList
        ref={ref}
        data={values}
        keyExtractor={(v) => `${label}-${v}`}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        bounces={false}
        onScroll={onWheel(values, set)}
        onMomentumScrollEnd={onWheel(values, set)}
        onScrollEndDrag={onWheel(values, set)}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        scrollEventThrottle={16}
      />
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Rest duration"
      headerRight={
        <IconButton size="md" ghost onPress={onClose}>
          <X size={20} color={COLORS.TEXT_TERTIARY} />
        </IconButton>
      }
    >
      <View style={styles.pickerWrap}>
        <View style={[UI.inset, styles.selectionWindow]} pointerEvents="none" />
        <View style={styles.pickerRow}>
          {wheel(minRef, MINUTES, "min", setMinute)}
          <Text style={[TYPE.monoLarge, styles.separator]}>:</Text>
          {wheel(secRef, SECONDS, "sec", setSecond)}
        </View>
      </View>
      <Text style={[TYPE.bodyMuted, styles.footer]}>
        Selected:{" "}
        <Text style={{ color: COLORS.ACCENT_BLUE }}>
          {minute}m {second}s
        </Text>
      </Text>
      <Button
        label="Save"
        tone="primary"
        variant="filled"
        icon={<Check size={16} color={buttonForeground("primary", "filled")} />}
        onPress={() => {
          onSave(minute * 60 + second);
          onClose();
        }}
        style={styles.save}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pickerWrap: {
    height: PICKER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: SPACE.xxxl,
  },
  selectionWindow: {
    position: "absolute",
    height: ITEM_HEIGHT,
    left: SPACE.xxl,
    right: SPACE.xxl,
    borderRadius: RADIUS.container,
    backgroundColor: SURFACE.raised,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: PICKER_HEIGHT,
    width: "100%",
    paddingHorizontal: SPACE.xxl,
  },
  column: { flex: 1, height: PICKER_HEIGHT, maxWidth: 140 },
  columnLabel: { position: "absolute", top: -SPACE.xxl, alignSelf: "center" },
  separator: { marginHorizontal: SPACE.lg },
  list: { flex: 1, width: "100%" },
  item: { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center", width: "100%" },
  footer: { textAlign: "center", paddingTop: SPACE.sm },
  save: { marginHorizontal: SPACE.xl, marginTop: SPACE.xl },
});

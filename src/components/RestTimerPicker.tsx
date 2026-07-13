import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  ListRenderItem,
  Pressable,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { COLORS } from '@/src/constants/colors';
import { FONT_FAMILIES } from '@/src/constants/fonts';
import { UI } from '@/constants/ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface RestTimerPickerProps {
  visible: boolean;
  initialSeconds: number;
  onClose: () => void;
  onSave: (seconds: number) => void;
}

const MINUTES = Array.from({ length: 21 }, (_, i) => i); // 0-20 min
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10... 55 sec

function getPickerSelection(totalSeconds: number) {
  const safeTotal = Math.max(0, totalSeconds);
  const minuteMax = MINUTES[MINUTES.length - 1];
  const secondMax = SECONDS[SECONDS.length - 1];

  const minuteValue = Math.min(Math.floor(safeTotal / 60), minuteMax);
  const snappedSeconds = Math.round((safeTotal % 60) / 5) * 5;
  const secondValue = Math.min(Math.max(snappedSeconds, 0), secondMax);

  const minuteIndex = Math.max(0, MINUTES.indexOf(minuteValue));
  const secondIndex = Math.max(0, SECONDS.indexOf(secondValue));

  return { minuteValue, secondValue, minuteIndex, secondIndex };
}

export default function RestTimerPicker({
  visible,
  initialSeconds,
  onClose,
  onSave,
}: RestTimerPickerProps) {
  const initialSelection = getPickerSelection(initialSeconds);
  const [selectedMin, setSelectedMin] = useState(initialSelection.minuteValue);
  const [selectedSec, setSelectedSec] = useState(initialSelection.secondValue);
  const [renderVisible, setRenderVisible] = useState(visible);

  const minListRef = useRef<FlatList<number>>(null);
  const secListRef = useRef<FlatList<number>>(null);
  const isInitializingScroll = useRef(false);
  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Drive the backdrop/sheet animation on open/close.
  useEffect(() => {
    if (visible) {
      setRenderVisible(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setRenderVisible(false));
    }
  }, [visible]);

  // Sync wheel position to the current value every time the modal opens.
  useEffect(() => {
    if (!visible) return;

    const { minuteValue, secondValue, minuteIndex, secondIndex } = getPickerSelection(initialSeconds);
    setSelectedMin(minuteValue);
    setSelectedSec(secondValue);

    isInitializingScroll.current = true;

    const frame = requestAnimationFrame(() => {
      minListRef.current?.scrollToOffset({
        offset: minuteIndex * ITEM_HEIGHT,
        animated: false,
      });
      secListRef.current?.scrollToOffset({
        offset: secondIndex * ITEM_HEIGHT,
        animated: false,
      });
    });

    const doneTimer = setTimeout(() => {
      isInitializingScroll.current = false;
    }, 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(doneTimer);
      isInitializingScroll.current = false;
    }
  }, [visible, initialSeconds]);

  const handleSave = () => {
    onSave(selectedMin * 60 + selectedSec);
    onClose();
  };

  const handleMinScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isInitializingScroll.current) return;
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < MINUTES.length) {
      setSelectedMin(MINUTES[index]);
    }
  };

  const handleSecScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isInitializingScroll.current) return;
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < SECONDS.length) {
      setSelectedSec(SECONDS[index]);
    }
  };

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.85],
  });

  const slideUp = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [PICKER_HEIGHT + 200, 0],
  });

  const renderItem: ListRenderItem<number> = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>
        {String(item).padStart(2, '0')}
      </Text>
    </View>
  );

  if (!renderVisible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Sibling backdrop for closing on tap outside */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[styles.container, { transform: [{ translateY: slideUp }] }]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={24} color={COLORS.DANGER} />
          </Pressable>
          <Text style={styles.title}>Rest Duration</Text>
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Check size={24} color={COLORS.ACCENT_GREEN} />
          </Pressable>
        </View>

        <View style={styles.pickerWrapper}>
          {/* The absolute centered selection window */}
          <View style={styles.selectionWindow} pointerEvents="none" />

          <View style={styles.pickerContainer}>
            {/* Minutes Column */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>MIN</Text>
              <FlatList
                ref={minListRef}
                data={MINUTES}
                keyExtractor={(i) => `min-${i}`}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                snapToAlignment="center"
                decelerationRate="normal"
                bounces={false}
                onScroll={handleMinScroll}
                onMomentumScrollEnd={handleMinScroll}
                onScrollEndDrag={handleMinScroll}
                renderItem={renderItem}
                getItemLayout={(_, index) => (
                  { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
                )}
                scrollEventThrottle={16}
              />
            </View>

            <Text style={styles.separator}>:</Text>

            {/* Seconds Column */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>SEC</Text>
              <FlatList
                ref={secListRef}
                data={SECONDS}
                keyExtractor={(i) => `sec-${i}`}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                snapToAlignment="center"
                decelerationRate="normal"
                bounces={false}
                onScroll={handleSecScroll}
                onMomentumScrollEnd={handleSecScroll}
                onScrollEndDrag={handleSecScroll}
                renderItem={renderItem}
                getItemLayout={(_, index) => (
                  { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
                )}
                scrollEventThrottle={16}
              />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Selected: <Text style={{color: COLORS.ACCENT_BLUE}}>{selectedMin}m {selectedSec}s</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,1)',
  },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  closeBtn: {
    padding: 8,
  },
  saveBtn: {
    padding: 8,
  },
  pickerWrapper: {
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  selectionWindow: {
    position: 'absolute',
    height: ITEM_HEIGHT,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
    width: '100%',
    paddingHorizontal: 24,
  },
  column: {
    flex: 1,
    height: PICKER_HEIGHT,
    maxWidth: 140,
  },
  columnLabel: {
    position: 'absolute',
    top: -25,
    alignSelf: 'center',
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  separator: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 15,
    fontFamily: FONT_FAMILIES.MONO,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingVertical: ITEM_HEIGHT,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  itemText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MONO,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.MEDIUM,
  }
});

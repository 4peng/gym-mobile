import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { COLORS } from '@/src/constants/colors';
import { FONT_FAMILIES } from '@/src/constants/fonts';

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

const MINUTES = Array.from({ length: 11 }, (_, i) => i); // 0-10 min
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10... 55 sec

export default function RestTimerPicker({
  visible,
  initialSeconds,
  onClose,
  onSave,
}: RestTimerPickerProps) {
  const [selectedMin, setSelectedMin] = useState(Math.floor(initialSeconds / 60));
  const [selectedSec, setSelectedSec] = useState(initialSeconds % 60);

  const minListRef = useRef<FlatList>(null);
  const secListRef = useRef<FlatList>(null);

  // Initial scroll to position
  useEffect(() => {
    if (visible) {
      const m = Math.floor(initialSeconds / 60);
      const s = initialSeconds % 60;
      setSelectedMin(m);
      setSelectedSec(s);
      
      // Small delay to ensure list is rendered before scrolling
      setTimeout(() => {
        minListRef.current?.scrollToOffset({
          offset: MINUTES.indexOf(m) * ITEM_HEIGHT,
          animated: false,
        });
        secListRef.current?.scrollToOffset({
          offset: SECONDS.indexOf(s) * ITEM_HEIGHT,
          animated: false,
        });
      }, 100);
    }
  }, [visible, initialSeconds]);

  const handleSave = () => {
    onSave(selectedMin * 60 + selectedSec);
    onClose();
  };

  const handleMinScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < MINUTES.length) {
      setSelectedMin(MINUTES[index]);
    }
  };

  const handleSecScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < SECONDS.length) {
      setSelectedSec(SECONDS[index]);
    }
  };

  const renderItem = (item: number) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>
        {String(item).padStart(2, '0')}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
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
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleMinScroll}
                  onScrollEndDrag={handleMinScroll}
                  renderItem={({ item }) => renderItem(item)}
                  contentContainerStyle={styles.listContent}
                  getItemLayout={(_, index) => (
                    { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
                  )}
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
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleSecScroll}
                  onScrollEndDrag={handleSecScroll}
                  renderItem={({ item }) => renderItem(item)}
                  contentContainerStyle={styles.listContent}
                  getItemLayout={(_, index) => (
                    { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
                  )}
                />
              </View>
            </View>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Selected: <Text style={{color: COLORS.ACCENT_BLUE}}>{selectedMin}m {selectedSec}s</Text>
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
    width: '80%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
  },
  column: {
    alignItems: 'center',
    width: 80,
    height: PICKER_HEIGHT,
  },
  columnLabel: {
    position: 'absolute',
    top: -25,
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
  },
  listContent: {
    // Add padding to top and bottom so first/last items can be centered
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
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

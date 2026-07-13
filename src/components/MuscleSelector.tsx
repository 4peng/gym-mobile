import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  BackHandler,
  Platform,
  PanResponder,
} from 'react-native';
import { Check, ChevronDown, Activity } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { FONT_FAMILIES } from '@/constants/fonts';
import { UI } from '@/constants/ui';
import {
  expandPrimaryMusclesForDetailedMode,
  collapseDetailedMusclesToPrimary,
  DETAILED_MODE_MUSCLE_GROUPS,
  DETAILED_MUSCLE_GROUPS,
  MUSCLE_LABELS,
  MUSCLE_GROUPS,
  MuscleGroup,
} from '@/constants/muscles';
import { useUiPreferencesStore } from '@/stores/uiPreferencesStore';
import { HapticFeedback } from '@/utils/haptics';


interface MuscleSelectorProps {
  selectedMuscles: MuscleGroup[];
  onSelect: (muscles: MuscleGroup[]) => void;
  label?: string;
  // External control
  visible?: boolean;
  onClose?: () => void;
}

export default function MuscleSelector({
  selectedMuscles,
  onSelect,
  label = "Targeted Muscles",
  visible: externalVisible,
  onClose: externalOnClose,
}: MuscleSelectorProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [draftSelectedMuscles, setDraftSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [renderVisible, setRenderVisible] = useState(false);

  const animValue = useRef(new Animated.Value(0)).current;
const dragOffset = useRef(new Animated.Value(0)).current;

  const showDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.showDetailedMuscleGroups
  );
  const toggleDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.toggleDetailedMuscleGroups
  );



  const isControlled = externalVisible !== undefined;
  const isVisible = isControlled ? externalVisible : internalVisible;
  const hide = () => (isControlled ? externalOnClose?.() : setInternalVisible(false));
  const show = () => (isControlled ? null : setInternalVisible(true));

  const detailedSet = new Set<MuscleGroup>(DETAILED_MUSCLE_GROUPS as readonly MuscleGroup[]);
  const normalizedSelectedMuscles = useMemo(() => (showDetailedMuscleGroups
    ? expandPrimaryMusclesForDetailedMode(selectedMuscles)
    : selectedMuscles), [showDetailedMuscleGroups, selectedMuscles]);

  const availableMuscles = showDetailedMuscleGroups
    ? DETAILED_MODE_MUSCLE_GROUPS
    : Array.from(
        new Set([
          ...MUSCLE_GROUPS,
          ...selectedMuscles.filter((m) => detailedSet.has(m)),
        ])
      );

  useEffect(() => {
    if (Platform.OS === 'android' && isVisible) {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        applyAndClose();
        return true;
      });
      return () => subscription.remove();
    }
  }, [isVisible]);

  const toggleMuscle = (muscle: MuscleGroup) => {
    setDraftSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const handleToggleDetailed = () => {
    setDraftSelectedMuscles((prev) =>
      showDetailedMuscleGroups
        ? collapseDetailedMusclesToPrimary(prev)
        : expandPrimaryMusclesForDetailedMode(prev)
    );
    toggleDetailedMuscleGroups();
    HapticFeedback.selection();
  };

  const selectedLabels = normalizedSelectedMuscles.length > 0
    ? normalizedSelectedMuscles.map(m => MUSCLE_LABELS[m]).join(', ')
    : 'None selected';

  const applyAndClose = () => {
    onSelect(draftSelectedMuscles);
    hide();
  };

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.85],
  });

const slideUp = animValue.interpolate({
  inputRange: [0, 1],
  outputRange: [600, 0],
});

// Drag-to-close functionality
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to vertical downward drags
      return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderMove: (_, gestureState) => {
      // Only allow downward drag
      if (gestureState.dy > 0) {
        dragOffset.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 150) {
        // Close if dragged down more than 150px
        applyAndClose();
      }
      // Reset drag offset with spring animation
      Animated.spring(dragOffset, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  })
).current;

const modalContent = (
    <View style={styles.absoluteOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={applyAndClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: slideUp },
              { translateY: dragOffset }
            ]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{label}</Text>
            <Pressable onPress={handleToggleDetailed} style={styles.detailedToggle}>
              <Activity size={12} color={showDetailedMuscleGroups ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY} />
              <Text style={[styles.detailedToggleText, showDetailedMuscleGroups && { color: COLORS.ACCENT_BLUE }]}>
                {showDetailedMuscleGroups ? "DETAILED MODE" : "SIMPLE MODE"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={applyAndClose} style={styles.closeBtn}>
              <Check size={24} color={COLORS.ACCENT_GREEN} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {availableMuscles.map((m) => {
            const isActive = draftSelectedMuscles.includes(m);
            return (
              <Pressable
                key={m}
                onPress={() => toggleMuscle(m)}
                style={[
                  styles.item,
                  isActive && styles.itemActive
                ]}
              >
                <Text style={[
                  styles.itemText,
                  isActive && styles.itemTextActive
                ]}>
                  {MUSCLE_LABELS[m]}
                </Text>
                {isActive && <Check size={18} color={COLORS.ACCENT_BLUE} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );

  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = isVisible;
    if (isVisible) {
      if (!wasVisible) {
        // Seed the draft from committed props only on the closed->open transition,
        // so toggling Simple/Detailed mode while open doesn't discard in-progress edits.
        setDraftSelectedMuscles(normalizedSelectedMuscles);
        setRenderVisible(true);
        Animated.timing(animValue, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } else if (wasVisible) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setRenderVisible(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  if (isControlled) {
    return renderVisible ? modalContent : null;
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={show}
        style={({ pressed }) => [
          styles.trigger,
          pressed && { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.05)' }
        ]}
      >
        <View style={styles.triggerInfo}>
          <Text style={styles.triggerLabel}>{label}</Text>
          <Text style={styles.triggerValue} numberOfLines={1}>
            {selectedLabels}
          </Text>
        </View>
        <ChevronDown size={18} color={COLORS.TEXT_TERTIARY} />
      </Pressable>
      {renderVisible ? modalContent : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: UI.RADIUS_CONTAINER,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  triggerInfo: {
    flex: 1,
    marginRight: 12,
  },
  triggerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  triggerValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  absoluteOverlay: {
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
    borderTopLeftRadius: UI.RADIUS_HUD,
    borderTopRightRadius: UI.RADIUS_HUD,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  detailedToggleText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: UI.RADIUS_CONTAINER,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  itemActive: {
    backgroundColor: 'rgba(11, 130, 255, 0.08)',
    borderColor: 'rgba(11, 130, 255, 0.2)',
  },
  itemText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  itemTextActive: {
    color: COLORS.TEXT_PRIMARY,
  }
});

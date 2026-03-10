import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  FlatList,
} from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/src/constants/colors';
import { FONT_FAMILIES } from '@/src/constants/fonts';
import {
  collapseDetailedMusclesToPrimary,
  DETAILED_MODE_MUSCLE_GROUPS,
  DETAILED_MUSCLE_GROUPS,
  expandPrimaryMusclesForDetailedMode,
  MUSCLE_LABELS,
  MUSCLE_GROUPS,
  MuscleGroup,
} from '@/src/constants/muscles';
import { useUiPreferencesStore } from '@/stores/uiPreferencesStore';

interface MuscleSelectorProps {
  selectedMuscles: MuscleGroup[];
  onSelect: (muscles: MuscleGroup[]) => void;
  label?: string;
}

export default function MuscleSelector({
  selectedMuscles,
  onSelect,
  label = "Targeted Muscles"
}: MuscleSelectorProps) {
  const [visible, setVisible] = useState(false);
  const [draftSelectedMuscles, setDraftSelectedMuscles] = useState<MuscleGroup[]>([]);
  const showDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.showDetailedMuscleGroups
  );

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
    if (visible) {
      setDraftSelectedMuscles(normalizedSelectedMuscles);
    }
  }, [visible, normalizedSelectedMuscles]);

  const toggleMuscle = (muscle: MuscleGroup) => {
    setDraftSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const selectedLabels = normalizedSelectedMuscles.length > 0 
    ? normalizedSelectedMuscles.map(m => MUSCLE_LABELS[m]).join(', ')
    : 'None selected';

  const closeAndApply = () => {
    onSelect(collapseDetailedMusclesToPrimary(draftSelectedMuscles));
    setVisible(false);
  };

  const closeAndCancel = () => {
    setVisible(false);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable 
        onPress={() => setVisible(true)}
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

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closeAndCancel}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeAndCancel}
          />
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>{label}</Text>
              <Pressable onPress={closeAndApply} style={styles.closeBtn}>
                <Check size={24} color={COLORS.ACCENT_GREEN} />
              </Pressable>
            </View>

            <FlatList
              data={availableMuscles}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: m }) => {
                const isActive = draftSelectedMuscles.includes(m);
                return (
                  <Pressable
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
              }}
            />
          </View>
        </View>
      </Modal>
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
    borderRadius: 16,
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
  },
  triggerValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
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
    borderRadius: 16,
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

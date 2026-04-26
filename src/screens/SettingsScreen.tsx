'use client';

import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Clipboard,
  Platform,
  TextInput,
  Animated,
  Easing,
} from "react-native";
import { ChevronLeft, Database, Download, ShieldAlert, Share2, RefreshCw, Tags } from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { showConfirm, showAlert } from "@/utils/alerts";

export default function SettingsScreen() {
  const router = useAppRouter();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const runFullSync = useSyncStore((s) => s.runFullSync);
  const forceResync = useSyncStore((s) => s.forceResync);
  const programs = useProgramStore((s) => s.programs);
  const history = useWorkoutSessionStore((s) => s.history);
  const showDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.showDetailedMuscleGroups
  );
  const toggleDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.toggleDetailedMuscleGroups
  );
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);
  const setAnalyticsBodyweight = useUiPreferencesStore((s) => s.setAnalyticsBodyweight);
  const toggleAnalyticsBodyweightUnit = useUiPreferencesStore(
    (s) => s.toggleAnalyticsBodyweightUnit
  );
  const preferredWeightUnit = useUiPreferencesStore((s) => s.preferredWeightUnit);
  const setPreferredWeightUnit = useUiPreferencesStore((s) => s.setPreferredWeightUnit);
  const [analyticsBodyweightText, setAnalyticsBodyweightText] = useState(
    analyticsBodyweight !== null ? String(analyticsBodyweight) : ""
  );

  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setAnalyticsBodyweightText(
      analyticsBodyweight !== null ? String(analyticsBodyweight) : ""
    );
  }, [analyticsBodyweight]);

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSync = useCallback(() => {
    runFullSync();
  }, [runFullSync]);

  const commitAnalyticsBodyweight = useCallback(() => {
    const normalizedText = analyticsBodyweightText.trim().replace(",", ".");
    if (normalizedText === "") {
      setAnalyticsBodyweight(null);
      return;
    }
    const parsed = Number(normalizedText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAnalyticsBodyweightText(analyticsBodyweight !== null ? String(analyticsBodyweight) : "");
      showAlert("Invalid Bodyweight", "Enter a positive number or leave it blank.");
      return;
    }
    setAnalyticsBodyweight(parsed);
  }, [analyticsBodyweight, analyticsBodyweightText, setAnalyticsBodyweight]);

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      programs,
      history,
    };
    const json = JSON.stringify(data, null, 2);
    Clipboard.setString(json);
    showAlert("Success", "Backup data copied to clipboard! Save it in a text file.");
  };

  const runMergeDiagnostic = () => {
    const workoutId = "diag-merge-" + Date.now();
    const base = { _id: workoutId, userId: "test", startedAt: "2026-01-01T10:00:00Z", updatedAt: 1000 };
    
    const local = { ...base, exercises: [{ id: "ex-1", name: "Local Exercise", sets: [], restSeconds: 60, notes: "" }] };
    const remote = { ...base, updatedAt: 2000, exercises: [{ id: "ex-2", name: "Remote Exercise", sets: [], restSeconds: 60, notes: "" }] };

    const store = useWorkoutSessionStore.getState();
    const originalHistory = [...store.history];
    
    try {
      useWorkoutSessionStore.setState({ history: [local as any, ...originalHistory] });
      store.applySyncMerge([remote as any], Date.now());
      const merged = useWorkoutSessionStore.getState().history.find(w => w._id === workoutId);
      const exCount = merged?.exercises.length || 0;
      
      if (exCount === 2) {
        showAlert("Merge Diagnostic", "SUCCESS: Deep merge preserved both local and remote exercises (2 total). Your data is safe.");
      } else {
        showAlert("Merge Diagnostic", `FAILED: Found ${exCount} exercises. Expected 2. Data loss occurred.`);
      }
    } finally {
      useWorkoutSessionStore.setState({ 
        history: useWorkoutSessionStore.getState().history.filter(w => w._id !== workoutId) 
      });
    }
  };

  const handleHardReset = () => {
    showConfirm(
      "Deep Hard Reset",
      "This will WIPE all local data and re-download everything from the database. Un-synced changes WILL be lost. Are you sure?",
      () => {
        forceResync();
        router.push("/programs/");
      }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
          <ChevronLeft size={28} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Synchronization</Text>
        <View style={[UI.SHARED.card, { padding: 0, marginBottom: 24 }]}>
          <Pressable 
            style={({ pressed }) => [styles.option, (pressed || isSyncing) && styles.pressed]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <RefreshCw size={20} color={COLORS.ACCENT_BLUE} />
              </Animated.View>
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{isSyncing ? "Syncing..." : "Sync with Cloud"}</Text>
              <Text style={styles.optionDesc}>Push local changes and fetch updates</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Display</Text>
        <View style={[UI.SHARED.card, { padding: 0, marginBottom: 24 }]}>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={toggleDetailedMuscleGroups}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
              <Tags size={20} color={COLORS.ACCENT_BLUE} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Detailed Muscle Groups</Text>
              <Text style={styles.optionDesc}>Show advanced tags in muscle picker</Text>
            </View>
            <View style={[styles.togglePill, showDetailedMuscleGroups && styles.togglePillActive]}>
              <Text style={[styles.toggleText, showDetailedMuscleGroups && styles.toggleTextActive]}>
                {showDetailedMuscleGroups ? "ON" : "OFF"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.option}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
              <RefreshCw size={20} color={COLORS.ACCENT_BLUE} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Preferred Weight Unit</Text>
              <Text style={styles.optionDesc}>Used for new exercise cards</Text>
            </View>
            <View style={styles.unitToggleGroup}>
              <Pressable
                onPress={() => setPreferredWeightUnit("kg")}
                style={[
                  styles.unitBtn,
                  preferredWeightUnit === "kg" && styles.unitBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.unitBtnText,
                    preferredWeightUnit === "kg" && styles.unitBtnTextActive,
                  ]}
                >
                  KG
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPreferredWeightUnit("lbs")}
                style={[
                  styles.unitBtn,
                  preferredWeightUnit === "lbs" && styles.unitBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.unitBtnText,
                    preferredWeightUnit === "lbs" && styles.unitBtnTextActive,
                  ]}
                >
                  LBS
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Training Profile</Text>
        <View style={[UI.SHARED.card, { marginBottom: 24 }]}>
          <Text style={styles.profileLabel}>Analytics Bodyweight</Text>
          <Text style={styles.profileDesc}>
            Used for bodyweight strength exercise analytics like pull-ups, dips, and push-ups.
          </Text>
          <View style={styles.profileRow}>
            <View style={styles.bodyweightInputShell}>
              <TextInput
                style={styles.bodyweightInput}
                value={analyticsBodyweightText}
                onChangeText={setAnalyticsBodyweightText}
                onBlur={commitAnalyticsBodyweight}
                onEndEditing={commitAnalyticsBodyweight}
                placeholder="Not set"
                placeholderTextColor={COLORS.TEXT_TERTIARY}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable
              onPress={toggleAnalyticsBodyweightUnit}
              style={({ pressed }) => [
                styles.unitToggle,
                pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.unitToggleText}>{analyticsBodyweightUnit.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Data Management</Text>
        <View style={[UI.SHARED.card, { padding: 0 }]}>
          <Pressable 
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={handleExport}
            onLongPress={runMergeDiagnostic}
            delayLongPress={2000}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
              <Download size={20} color={COLORS.ACCENT_BLUE} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Export Backup (JSON)</Text>
              <Text style={styles.optionDesc}>Copies all your data to clipboard</Text>
            </View>
            <Share2 size={18} color={COLORS.TEXT_TERTIARY} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable 
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={handleHardReset}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <ShieldAlert size={20} color={COLORS.DANGER} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: COLORS.DANGER }]}>Hard Reset & Sync</Text>
              <Text style={styles.optionDesc}>Wipe local cache and pull from DB</Text>
            </View>
            <Database size={18} color={COLORS.TEXT_TERTIARY} />
          </Pressable>
        </View>

        <Text style={styles.infoText}>
          Gym Tracking App v1.0.0{"\n"}
          Offline-first architecture with granular deep merging.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    paddingTop: UI.HEADER_TOP - 10,
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  content: {
    paddingHorizontal: UI.LAYOUT_PADDING,
  },
  profileLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  profileDesc: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  profileRow: {
    flexDirection: "row",
    gap: 10,
  },
  bodyweightInputShell: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  bodyweightInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
    padding: 0,
  },
  unitToggle: {
    minWidth: 72,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "rgba(11, 130, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  unitToggleText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 15,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    letterSpacing: 0.6,
  },
  sectionLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pressed: {
    backgroundColor: COLORS.CARD_HOVER,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionDesc: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    marginTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 12,
  },
  togglePill: {
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  togglePillActive: {
    backgroundColor: "rgba(11, 130, 255, 0.2)",
    borderColor: "rgba(11, 130, 255, 0.4)",
  },
  toggleText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  toggleTextActive: {
    color: COLORS.ACCENT_BLUE,
  },
  unitToggleGroup: {
    flexDirection: "row",
    backgroundColor: COLORS.BG,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  unitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitBtnActive: {
    backgroundColor: "rgba(11, 130, 255, 0.15)",
  },
  unitBtnText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  unitBtnTextActive: {
    color: COLORS.ACCENT_BLUE,
  },
  infoText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
    lineHeight: 18,
  }
});

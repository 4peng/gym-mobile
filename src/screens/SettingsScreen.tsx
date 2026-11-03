import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  RefreshCw,
  Tags,
} from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";
import { useProgramStore } from "@/stores/programStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, LAYOUT, MOTION, SPACE, TYPE, UI } from "@/constants/theme";
import { showAlert, showConfirm } from "@/utils/alerts";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip } from "@/components/ui/Chip";

const UNITS = [
  { value: "kg", label: "KG" },
  { value: "lbs", label: "LBS" },
] as const;

function SettingsRow({
  icon,
  title,
  description,
  right,
  onPress,
  disabled,
  danger,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress && UI.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.iconBox}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, danger && { color: COLORS.DANGER }]}>{title}</Text>
        <Text style={TYPE.caption}>{description}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncSuccess = useSyncStore((s) => s.lastSyncSuccess);
  const pushPending = useSyncStore((s) => s.pushPending);
  const backupEverything = useSyncStore((s) => s.backupEverything);
  const restoreFromCloud = useSyncStore((s) => s.restoreFromCloud);
  const programs = useProgramStore(useShallow((s) => s.programs));
  const showDetailed = useUiPreferencesStore((s) => s.showDetailedMuscleGroups);
  const toggleDetailed = useUiPreferencesStore((s) => s.toggleDetailedMuscleGroups);
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);
  const setAnalyticsBodyweight = useUiPreferencesStore((s) => s.setAnalyticsBodyweight);
  const toggleAnalyticsBodyweightUnit = useUiPreferencesStore(
    (s) => s.toggleAnalyticsBodyweightUnit,
  );
  const preferredWeightUnit = useUiPreferencesStore((s) => s.preferredWeightUnit);
  const setPreferredWeightUnit = useUiPreferencesStore((s) => s.setPreferredWeightUnit);
  const sessionCount = useDbQuery(() => workoutRepo.count());

  const [bodyweightText, setBodyweightText] = useState(
    analyticsBodyweight === null ? "" : String(analyticsBodyweight),
  );
  useEffect(
    () => setBodyweightText(analyticsBodyweight === null ? "" : String(analyticsBodyweight)),
    [analyticsBodyweight],
  );

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isSyncing) return spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: MOTION.spin,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isSyncing, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const commitBodyweight = () => {
    const text = bodyweightText.trim().replace(",", ".");
    if (text === "") return setAnalyticsBodyweight(null);
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) {
      setBodyweightText(analyticsBodyweight === null ? "" : String(analyticsBodyweight));
      return showAlert("Invalid bodyweight", "Enter a positive number or leave it blank.");
    }
    setAnalyticsBodyweight(n);
  };

  const handleExport = async () => {
    const history = workoutRepo.list(sessionCount, 0);
    await Clipboard.setStringAsync(
      JSON.stringify({ exportDate: new Date().toISOString(), programs, history }, null, 2),
    );
    showAlert(
      "Copied",
      `${programs.length} routines and ${history.length} sessions copied to the clipboard as JSON.`,
    );
  };

  const handleRestore = () =>
    showConfirm(
      "Restore from cloud",
      "Replace everything on this phone with the cloud backup? Custom and pinned exercises are kept.",
      () => void restoreFromCloud(),
    );

  const statusText = isSyncing
    ? "Working..."
    : lastSyncSuccess === false
      ? "Last attempt failed"
      : lastSyncSuccess
        ? "Up to date"
        : "Push pending edits and deletes";

  return (
    <View style={UI.screen}>
      <ScreenHeader title="Settings" back />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Cloud backup</SectionLabel>
        <View style={[UI.card, styles.group]}>
          <SettingsRow
            icon={
              <Animated.View style={{ transform: [{ rotate }] }}>
                <RefreshCw size={20} color={COLORS.TEXT_SECONDARY} />
              </Animated.View>
            }
            title="Back up now"
            description={statusText}
            onPress={() => void pushPending()}
            disabled={isSyncing}
          />
          <View style={[UI.hairline, styles.divider]} />
          <SettingsRow
            icon={<CloudUpload size={20} color={COLORS.TEXT_SECONDARY} />}
            title="Back up everything"
            description="Re-upload every routine and session"
            onPress={() => void backupEverything()}
            disabled={isSyncing}
          />
          <View style={[UI.hairline, styles.divider]} />
          <SettingsRow
            icon={<CloudDownload size={20} color={COLORS.DANGER} />}
            title="Restore from cloud"
            description="Replace local data with the backup"
            onPress={handleRestore}
            disabled={isSyncing}
            danger
          />
        </View>

        <SectionLabel>Display</SectionLabel>
        <View style={[UI.card, styles.group]}>
          <SettingsRow
            icon={<Tags size={20} color={COLORS.TEXT_SECONDARY} />}
            title="Detailed muscle groups"
            description="Show delts, lats, biceps and so on"
            onPress={toggleDetailed}
            right={
              <Chip
                label={showDetailed ? "On" : "Off"}
                active={showDetailed}
                onPress={toggleDetailed}
              />
            }
          />
          <View style={[UI.hairline, styles.divider]} />
          <SettingsRow
            icon={<RefreshCw size={20} color={COLORS.TEXT_SECONDARY} />}
            title="Preferred weight unit"
            description="Used for new exercises"
            right={
              <SegmentedControl
                compact
                options={UNITS}
                value={preferredWeightUnit}
                onChange={setPreferredWeightUnit}
              />
            }
          />
        </View>

        <SectionLabel>Training profile</SectionLabel>
        <View style={[UI.card, styles.profile]}>
          <Text style={TYPE.body}>Analytics bodyweight</Text>
          <Text style={TYPE.bodyMuted}>
            Added to the load of bodyweight exercises like pull-ups, dips and push-ups.
          </Text>
          <View style={[UI.row, { gap: SPACE.sm }]}>
            <TextInput
              style={[UI.inset, styles.bodyweightInput]}
              value={bodyweightText}
              onChangeText={setBodyweightText}
              onBlur={commitBodyweight}
              placeholder="Not set"
              placeholderTextColor={COLORS.TEXT_TERTIARY}
              keyboardType="decimal-pad"
            />
            <SegmentedControl
              compact
              options={UNITS}
              value={analyticsBodyweightUnit}
              onChange={(unit) =>
                unit !== analyticsBodyweightUnit && toggleAnalyticsBodyweightUnit()
              }
            />
          </View>
        </View>

        <SectionLabel>Data</SectionLabel>
        <View style={[UI.card, styles.group]}>
          <SettingsRow
            icon={<Download size={20} color={COLORS.TEXT_SECONDARY} />}
            title="Export as JSON"
            description="Copy every routine and session to the clipboard"
            onPress={() => void handleExport()}
            right={<Database size={18} color={COLORS.TEXT_TERTIARY} />}
          />
        </View>

        <Text style={[TYPE.caption, styles.footer]}>
          {sessionCount} sessions stored locally.{"\n"}Local first; the cloud is a backup.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: LAYOUT.gutter, paddingBottom: SPACE.xxxl },
  group: { marginBottom: SPACE.xxl, overflow: "hidden" },
  divider: { marginHorizontal: SPACE.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
  },
  iconBox: {
    width: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: { opacity: 0.3 },
  profile: { padding: SPACE.lg, gap: SPACE.sm, marginBottom: SPACE.xxl },
  bodyweightInput: {
    ...TYPE.monoMedium,
    flex: 1,
    minHeight: LAYOUT.buttonLg,
    paddingHorizontal: SPACE.lg,
  },
  footer: { textAlign: "center", marginTop: SPACE.lg },
});

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS, LAYOUT, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";

const SCRUB_ITEM_WIDTH = 64;
const SCRUB_GAP = SPACE.md;
/** Horizontal distance between scrubber items; the screen scrolls the rail by this per index. */
export const SCRUB_STEP = SCRUB_ITEM_WIDTH + SCRUB_GAP;
const POPUP_WIDTH = LAYOUT.screenWidth - (LAYOUT.gutter + SPACE.xs) * 2;
const SIDE_SPACER = POPUP_WIDTH / 2 - SCRUB_ITEM_WIDTH / 2;

interface ScrubberRailProps {
  exerciseIds: string[];
  exerciseNames: string[];
  exerciseProgress: number[];
  displayIndex: number;
  scrubberScrollRef: React.RefObject<ScrollView | null>;
}

const shorthand = (name: string) => (name || "EXER").substring(0, 4).toUpperCase();

/** Long-press scrubber that previews every exercise while dragging across the HUD pill. */
export const ScrubberRail = React.memo(function ScrubberRail({
  exerciseIds,
  exerciseNames,
  exerciseProgress,
  displayIndex,
  scrubberScrollRef,
}: ScrubberRailProps) {
  return (
    <View style={[styles.popup, UI.shadow]}>
      <ScrollView
        ref={scrubberScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEnabled={false}
      >
        <View style={{ width: SIDE_SPACER }} />
        {exerciseIds.map((id, idx) => {
          const active = displayIndex === idx;
          const progress = exerciseProgress[idx] || 0;
          return (
            <View key={id} style={styles.itemWrap}>
              <View style={[styles.item, active && styles.itemActive]}>
                <Text style={[styles.index, active && { color: COLORS.TEXT_PRIMARY }]}>
                  {String(idx + 1).padStart(2, "0")}
                </Text>
                <Text style={[styles.shorthand, active && { color: COLORS.ACCENT_BLUE }]}>
                  {shorthand(exerciseNames[idx])}
                </Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                      progress === 1 && { backgroundColor: COLORS.ACCENT_GREEN },
                    ]}
                  />
                </View>
                {active && (
                  <>
                    <View style={[styles.bracket, styles.tl]} />
                    <View style={[styles.bracket, styles.tr]} />
                    <View style={[styles.bracket, styles.bl]} />
                    <View style={[styles.bracket, styles.br]} />
                  </>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ width: SIDE_SPACER }} />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  popup: {
    position: "absolute",
    bottom: 110,
    left: LAYOUT.gutter + SPACE.xs,
    right: LAYOUT.gutter + SPACE.xs,
    height: 80,
    backgroundColor: SURFACE.sheet,
    borderRadius: RADIUS.container,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  content: { alignItems: "center", gap: SCRUB_GAP },
  itemWrap: { width: SCRUB_ITEM_WIDTH, height: 54, justifyContent: "center", alignItems: "center" },
  item: {
    width: "100%",
    height: "100%",
    borderRadius: RADIUS.item,
    backgroundColor: SURFACE.raised,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: SURFACE.hairline,
  },
  itemActive: { backgroundColor: "transparent", borderColor: "transparent" },
  index: { ...TYPE.mono, fontSize: 16, color: COLORS.TEXT_TERTIARY },
  shorthand: { ...TYPE.label, fontSize: 9, letterSpacing: 0.5, marginTop: 2 },
  progressBg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: SURFACE.raisedStrong,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.ACCENT_BLUE },
  bracket: { position: "absolute", width: 6, height: 6, borderColor: COLORS.ACCENT_BLUE },
  tl: { top: -2, left: -2, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: -2, right: -2, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2 },
});

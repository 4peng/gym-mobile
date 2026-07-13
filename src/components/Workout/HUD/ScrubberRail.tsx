import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";

const SCRUB_ITEM_WIDTH = 64; 
const SCRUB_GAP = 12;
const SCRUB_STEP = SCRUB_ITEM_WIDTH + SCRUB_GAP;
const POPUP_WIDTH = UI.WIDTH - 40;
const SIDE_SPACER = (POPUP_WIDTH / 2) - (SCRUB_ITEM_WIDTH / 2);

interface ScrubberRailProps {
  exerciseIds: string[];
  exerciseNames: string[];
  exerciseProgress: number[];
  displayIndex: number;
  scrubberScrollRef: React.RefObject<ScrollView | null>;
}

const getShorthand = (name: string) => (name || "EXER").substring(0, 4).toUpperCase();

export const ScrubberRail = React.memo(({ 
  exerciseIds, 
  exerciseNames, 
  exerciseProgress, 
  displayIndex,
  scrubberScrollRef
}: ScrubberRailProps) => {
  return (
    <View style={styles.scrubberPopup}>
      <ScrollView 
        ref={scrubberScrollRef} 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.scrubberPopupContent} 
        scrollEnabled={false}
      >
        <View style={{ width: SIDE_SPACER }} />
        {exerciseIds.map((id, idx) => {
          const isItemActive = displayIndex === idx;
          const progress = exerciseProgress[idx] || 0;
          return (
            <View key={id} style={styles.scrubberItemWrapper}>
              <View style={[styles.scrubberItem, isItemActive && styles.scrubberItemActive]}>
                <Text style={[styles.scrubberItemIndex, isItemActive && { color: COLORS.TEXT_PRIMARY }]}>
                    {(idx + 1).toString().padStart(2, '0')}
                </Text>
                <Text style={[styles.scrubberItemShorthand, isItemActive && { color: COLORS.ACCENT_BLUE }]}>
                    {getShorthand(exerciseNames[idx])}
                </Text>
                <View style={styles.scrubberItemProgressBg}>
                  <View style={[styles.scrubberItemProgressFill, { width: `${progress * 100}%` }, progress === 1 && { backgroundColor: COLORS.ACCENT_GREEN }]} />
                </View>
                {isItemActive && (
                  <>
                    <View style={[styles.bracket, styles.bracketTopLeft]} />
                    <View style={[styles.bracket, styles.bracketTopRight]} />
                    <View style={[styles.bracket, styles.bracketBottomLeft]} />
                    <View style={[styles.bracket, styles.bracketBottomRight]} />
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
  scrubberPopup: { position: "absolute", bottom: 110, left: 20, right: 20, height: 80, backgroundColor: "rgba(18, 18, 18, 0.95)", borderRadius: UI.RADIUS_CONTAINER, borderWidth: 1, borderColor: COLORS.BORDER, justifyContent: "center", alignItems: "center", overflow: "visible", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  scrubberPopupContent: { alignItems: "center", gap: SCRUB_GAP },
  scrubberItemWrapper: { width: SCRUB_ITEM_WIDTH, height: 54, justifyContent: "center", alignItems: "center" },
  scrubberItem: { width: "100%", height: "100%", borderRadius: UI.RADIUS_ITEM, backgroundColor: "rgba(255, 255, 255, 0.02)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.05)" },
  scrubberItemActive: { backgroundColor: "transparent", borderColor: "transparent" },
  scrubberItemIndex: { color: COLORS.TEXT_TERTIARY, fontSize: 16, fontWeight: "900", fontFamily: FONT_FAMILIES.MONO },
  scrubberItemShorthand: { color: COLORS.TEXT_TERTIARY, fontSize: 9, fontWeight: "800", fontFamily: FONT_FAMILIES.MONO, marginTop: 2, letterSpacing: 0.5 },
  scrubberItemProgressBg: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(255,255,255,0.05)" },
  scrubberItemProgressFill: { height: "100%", backgroundColor: COLORS.ACCENT_BLUE },
  bracket: { position: "absolute", width: 6, height: 6, borderColor: COLORS.ACCENT_BLUE },
  bracketTopLeft: { top: -2, left: -2, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTopRight: { top: -2, right: -2, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBottomRight: { bottom: -2, right: -2, borderBottomWidth: 2, borderRightWidth: 2 },
});

import { StyleSheet, Platform, Dimensions } from 'react-native';
import { COLORS } from './colors';
import { FONT_FAMILIES } from './fonts';

const { width } = Dimensions.get('window');

export const UI = {
  // ─── Dimensions ─────────────────────────────
  WIDTH: width,
  
  // ─── Spacing ────────────────────────────────
  LAYOUT_PADDING: 20,
  HEADER_TOP: 70,
  GAP: 12,
  
  // ─── Radius (Noir Standards) ────────────────
  RADIUS_CONTAINER: 16,
  RADIUS_ITEM: 12,
  RADIUS_INPUT: 16,
  RADIUS_HUD: 32, 

  // ─── Shared Styles ──────────────────────────
  SHARED: StyleSheet.create({
    // Ghost Icon Button (Neutral)
    iconBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      justifyContent: "center",
      alignItems: "center",
    },
    // Ghost Action Button (Success/Primary)
    actionBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: COLORS.ACCENT_GREEN,
      justifyContent: "center",
      alignItems: "center",
    },
    // Ghost Danger Button (Cancel/Remove)
    dangerBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: COLORS.DANGER,
      justifyContent: "center",
      alignItems: "center",
    },
    // HUD Control Pill (The bottom bar)
    hudPill: {
      height: 64,
      borderRadius: 16,
      backgroundColor: "rgba(18, 18, 18, 0.8)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    // Standard HUD Card
    card: {
      backgroundColor: COLORS.BG,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    // Section Label (Instrumentation Style)
    sectionLabel: {
      color: COLORS.TEXT_TERTIARY,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      fontFamily: FONT_FAMILIES.MONO,
      marginBottom: 12,
    },
    // Numeric Instrumentation (Monospaced)
    numericValue: {
      color: COLORS.TEXT_PRIMARY,
      fontFamily: FONT_FAMILIES.MONO,
      fontSize: 14,
      fontWeight: "700",
    }
  })
};

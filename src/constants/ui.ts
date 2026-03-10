import { StyleSheet, Platform } from 'react-native';
import { COLORS } from './colors';

export const UI = {
  // ─── Spacing ────────────────────────────────
  LAYOUT_PADDING: 24,
  HEADER_TOP: 70,
  GAP: 12,
  
  // ─── Radius ─────────────────────────────────
  RADIUS_CARD: 32,
  RADIUS_BUTTON: 26,
  RADIUS_INPUT: 18,
  RADIUS_PILL: 100,

  // ─── Shared Styles ──────────────────────────
  SHARED: StyleSheet.create({
    // Standard Header Icon Button (Circle)
    iconBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: COLORS.CARD_HOVER,
      justifyContent: "center",
      alignItems: "center",
    },
    // Primary Action Button (Filled Blue)
    actionBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: COLORS.ACCENT_BLUE,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: COLORS.ACCENT_BLUE,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    // Standard Card
    card: {
      backgroundColor: COLORS.CARD_BG,
      borderRadius: 32,
      padding: 24,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.03)",
    },
    // Section Label (Uppercase Muted)
    sectionLabel: {
      color: COLORS.TEXT_TERTIARY,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 16,
    },
    // Numeric Inputs (Weight/Reps)
    numericInput: {
      flex: 1,
      color: COLORS.TEXT_PRIMARY,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
      padding: 0,
    }
  })
};

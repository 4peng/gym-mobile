import { Dimensions, StyleSheet } from "react-native";

// ──────────────────────────────────────────────
// Design tokens. Every colour, radius, spacing and text style used by a screen
// or component comes from here; raw hex/rgba literals are lint errors elsewhere.
// ──────────────────────────────────────────────

export const COLORS = {
  BG: "#000000", // OLED black
  CARD_BG: "#121212",
  CARD_HOVER: "#1C1C1E",
  BORDER: "#1C1C1E",
  BORDER_LIGHT: "#27272A",

  ACCENT_BLUE: "#007AFF",
  ACCENT_YELLOW: "#FFCC00",
  ACCENT_GREEN: "#00FF99",
  ACCENT_GREEN_DEEP: "#003322",
  DANGER: "#FF3B30",
  ORANGE: "#FF4500",

  TEXT_PRIMARY: "#FFFFFF",
  TEXT_SECONDARY: "#A1A1AA",
  TEXT_TERTIARY: "#71717A",
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}, ${alpha})`;
}

/** The only translucent surfaces components may use. */
export const SURFACE = {
  raised: withAlpha(COLORS.TEXT_PRIMARY, 0.03),
  raisedStrong: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
  hairline: withAlpha(COLORS.TEXT_PRIMARY, 0.06),
  blueTint: withAlpha(COLORS.ACCENT_BLUE, 0.1),
  blueTintStrong: withAlpha(COLORS.ACCENT_BLUE, 0.18),
  blueBorder: withAlpha(COLORS.ACCENT_BLUE, 0.3),
  greenTint: withAlpha(COLORS.ACCENT_GREEN, 0.1),
  greenBorder: withAlpha(COLORS.ACCENT_GREEN, 0.3),
  yellowTint: withAlpha(COLORS.ACCENT_YELLOW, 0.15),
  yellowBorder: withAlpha(COLORS.ACCENT_YELLOW, 0.35),
  dangerTint: withAlpha(COLORS.DANGER, 0.1),
  backdrop: withAlpha(COLORS.BG, 0.85),
  sheet: withAlpha(COLORS.CARD_BG, 0.96),
} as const;

/** Set-marker colours by set type. */
export const SET_TYPE_COLORS = {
  working: COLORS.ACCENT_BLUE,
  warmup: COLORS.ACCENT_YELLOW,
  dropset: COLORS.ACCENT_GREEN,
} as const;

/**
 * Font registry. Adding a font: drop the file in assets/fonts/, add it here,
 * then reference it from FONT_FAMILIES.
 */
export const FONT_ASSETS = {
  "NeueHaasUnicaPro-Medium": require("../../assets/fonts/NeueHaasUnicaPro-Medium.ttf"),
  "SpaceMono-Regular": require("../../assets/fonts/SpaceMono-Regular.ttf"),
  "FiraCode-Bold": require("../../assets/fonts/FiraCode-Bold.ttf"),
  "NeoGramTrial-BoldCondensed": require("../../assets/fonts/NeoGramTrial-BoldCondensed.otf"),
  "NeoGramTrial-ExtraBold": require("../../assets/fonts/NeoGramTrial-ExtraBold.otf"),
  "NeoGramTrial-HeavyCondensed": require("../../assets/fonts/NeoGramTrial-HeavyCondensed.otf"),
  "Viga-Regular": require("../../assets/fonts/Viga-Regular.ttf"),
};

export const FONT_FAMILIES = {
  /** UI text. */
  MEDIUM: "Viga-Regular",
  /** Data / instrumentation. */
  MONO: "SpaceMono-Regular",
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const RADIUS = { sm: 6, item: 12, container: 16, sheet: 24, pill: 32 } as const;

export const LAYOUT = {
  screenWidth: Dimensions.get("window").width,
  /** Horizontal gutter for screen content. */
  gutter: SPACE.lg,
  /** Top padding for screens that draw their own header (status bar + breathing room). */
  headerTop: 60,
  /** Ghost button sizes. */
  buttonLg: 48,
  buttonMd: 40,
  buttonSm: 32,
  /** Sheet/overlay animation duration (ms). */
  sheetMs: 180,
} as const;

/** Text presets. Fonts: Viga for UI, SpaceMono for numbers and labels. */
export const TYPE = StyleSheet.create({
  title: { fontFamily: FONT_FAMILIES.MEDIUM, fontSize: 26, color: COLORS.TEXT_PRIMARY },
  heading: { fontFamily: FONT_FAMILIES.MEDIUM, fontSize: 18, color: COLORS.TEXT_PRIMARY },
  body: { fontFamily: FONT_FAMILIES.MEDIUM, fontSize: 15, color: COLORS.TEXT_PRIMARY },
  bodyMuted: {
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  caption: { fontFamily: FONT_FAMILIES.MEDIUM, fontSize: 12, color: COLORS.TEXT_TERTIARY },
  /** Small caps instrumentation label. */
  label: {
    fontFamily: FONT_FAMILIES.MONO,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.TEXT_TERTIARY,
  },
  mono: {
    fontFamily: FONT_FAMILIES.MONO,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  monoSmall: {
    fontFamily: FONT_FAMILIES.MONO,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  monoLarge: { fontFamily: FONT_FAMILIES.MONO, fontSize: 28, color: COLORS.TEXT_PRIMARY },
  monoHero: { fontFamily: FONT_FAMILIES.MONO, fontSize: 34, color: COLORS.TEXT_PRIMARY },
});

/** Shared layout styles. */
export const UI = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  /** Fills the parent (replacement for the deprecated absoluteFillObject). */
  fill: { position: "absolute", inset: 0 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.container,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  /** Faint inset panel inside a card. */
  inset: {
    backgroundColor: SURFACE.raised,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: SURFACE.hairline,
  },
  hairline: { height: 1, backgroundColor: SURFACE.hairline },
  /** Translucent floating bar (HUD nav, dashboard action bar). */
  hudPill: {
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.sheet,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  shadow: {
    shadowColor: COLORS.BG,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  pressed: { opacity: 0.75 },
});

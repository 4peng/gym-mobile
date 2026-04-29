export const COLORS = {
  // Base
  BG: "#000000",           // True OLED Black
  CARD_BG: "#121212",      // Deep charcoal for containers
  CARD_HOVER: "#1C1C1E",   // Hover/Pressed state
  BORDER: "#1C1C1E",       // Very subtle borders
  BORDER_LIGHT: "#27272A", 
  
  // Accents (HUD Style)
  ACCENT_BLUE: "#007AFF",  // Technical Blue
  ACCENT_YELLOW: "#FFCC00",// Warmup/Caution
  ACCENT_GREEN: "#00FF99", // Neon Success
  ACCENT_GREEN_DEEP: "#003322", // Background for completed sets
  DANGER: "#FF3B30",       // System Red
  
  // Text
  TEXT_PRIMARY: "#FFFFFF",
  TEXT_SECONDARY: "#A1A1AA", // Muted gray
  TEXT_TERTIARY: "#71717A",  // Even more muted
  
  // HUD Elements
  PROGRESS_BG: "rgba(0, 255, 153, 0.1)",
};

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

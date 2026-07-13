import { Platform } from 'react-native';

/**
 * Technical High-Performance Font Registry
 * 
 * ADDING NEW FONTS:
 * 1. Drop the .ttf/.otf file into assets/fonts/
 * 2. Add a 'Key': require(...) entry to FONT_ASSETS below.
 * 3. Update FONT_FAMILIES to use that 'Key'.
 */
export const FONT_ASSETS = {
  'NeueHaasUnicaPro-Medium': require('../../assets/fonts/NeueHaasUnicaPro-Medium.ttf'),
  'SpaceMono-Regular': require('../../assets/fonts/SpaceMono-Regular.ttf'),
  'FiraCode-Bold': require('../../assets/fonts/FiraCode-Bold.ttf'),
  'NeoGramTrial-BoldCondensed': require('../../assets/fonts/NeoGramTrial-BoldCondensed.otf'),
  'NeoGramTrial-ExtraBold': require('../../assets/fonts/NeoGramTrial-ExtraBold.otf'),
  'NeoGramTrial-HeavyCondensed': require('../../assets/fonts/NeoGramTrial-HeavyCondensed.otf'),
  'Viga-Regular': require('../../assets/fonts/Viga-Regular.ttf'),
};

export const FONT_FAMILIES = {
  // Main UI text
  MEDIUM: 'Viga-Regular',

  // Data / Instrumentation  
  MONO: 'SpaceMono-Regular',
};

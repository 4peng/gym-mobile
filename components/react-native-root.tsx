'use client';

import { AppRegistry } from 'react-native';
import React, { useMemo } from 'react';

// Register the app (required for StyleSheet to work correctly in some environments)
AppRegistry.registerComponent('Main', () => () => null);

export function ReactNativeRoot({ children }: { children: React.ReactNode }) {
  // This helps ensure StyleSheet is correctly initialized on the client
  return <>{children}</>;
}

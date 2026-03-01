import { Platform } from 'react-native';

/**
 * Shared navigation interface to bridge Next.js and Expo Router.
 */
export interface AppRouter {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
}

/**
 * Hook to get the correct router for the current platform.
 */
export function useAppRouter(): AppRouter {
  if (Platform.OS === 'web') {
    // Next.js (Web)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useRouter } = require('next/navigation');
      return useRouter();
    } catch (e) {
      // Fallback if Next.js router is not available (e.g. static export/simple web)
      console.warn('Next.js router not found, falling back to window.location');
      return {
        push: (href: string) => { window.location.href = href; },
        replace: (href: string) => { window.location.replace(href); },
        back: () => { window.history.back(); },
      };
    }
  } else {
    // Expo Router (Native)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useRouter } = require('expo-router');
    const router = useRouter();
    return {
      push: (href: string) => router.push(href as any),
      replace: (href: string) => router.replace(href as any),
      back: () => router.back(),
    };
  }
}

/**
 * Hook to get the correct route params for the current platform.
 */
export function useAppParams<T extends Record<string, string | string[] | undefined>>(): T {
  if (Platform.OS === 'web') {
    // Next.js (Web)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useParams } = require('next/navigation');
      return useParams() as T;
    } catch (e) {
      console.warn('Next.js useParams not found');
      return {} as T;
    }
  } else {
    // Expo Router (Native)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLocalSearchParams } = require('expo-router');
    return useLocalSearchParams() as T;
  }
}

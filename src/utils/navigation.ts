import { useRouter, useLocalSearchParams } from "expo-router";

/**
 * Thin navigation wrapper over Expo Router.
 *
 * (Historically this bridged a Next.js web target and Expo Router; the app is
 * now Expo Router only — including on web — so the dead Next.js branch and its
 * conditional `require()`-inside-a-hook were removed.)
 */
export interface AppRouter {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
}

/** Hook to get the app router. */
export function useAppRouter(): AppRouter {
  const router = useRouter();
  return {
    push: (href: string) => router.push(href as any),
    replace: (href: string) => router.replace(href as any),
    back: () => router.back(),
  };
}

/** Hook to get the current route params. */
export function useAppParams<
  T extends Record<string, string | string[] | undefined>,
>(): T {
  return useLocalSearchParams() as T;
}

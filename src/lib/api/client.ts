// ──────────────────────────────────────────────
// Base fetch wrapper for the REST API
// ──────────────────────────────────────────────
// All API calls go through this module.
// The base URL can be swapped per environment.

import { USER_ID } from "@/constants/user";

import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * For development, "localhost" differs by platform:
 * - Web: localhost
 * - Android Emulator: 10.0.2.2
 * - iOS Simulator: localhost
 * - Physical Device: Your machine's local IP (provided by expo-constants)
 */
const getBaseUrl = () => {
  if (__DEV__) {
    // If running via Expo, we can often get the host's IP address
    const debuggerHost = Constants.expoConfig?.hostUri;
    const localhost = debuggerHost?.split(":")[0] || "localhost";

    if (Platform.OS === "android" && localhost === "localhost") {
      return "http://10.0.2.2:4000";
    }
    return `http://${localhost}:4000`;
  }
  
  // Production URL
  return "https://api.yourproductionurl.com";
};

const BASE_URL = getBaseUrl();

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Thin wrapper around `fetch` with:
 *  - JSON content-type headers
 *  - userId header for auth
 *  - Typed response parsing
 *  - Error normalisation (never throws — returns `{ ok: false }`)
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": USER_ID,
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      return { ok: false, error: text, status: response.status };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, status: response.status };
  } catch (err) {
    // Network error / offline — perfectly normal in offline-first apps.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  }
}

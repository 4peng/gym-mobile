// ──────────────────────────────────────────────
// Base fetch wrapper for the REST API
// ──────────────────────────────────────────────
// All API calls go through this module.
// The base URL can be swapped per environment.

import { USER_ID } from "@/constants/user";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * QUICK TOGGLE FOR SERVER ADDRESS
 * Set this to "prod" to use Vercel, or "local" for local machine IP.
 */
const ENV: "local" | "prod" = "prod";

const PROD_URL = "https://apen-gym.vercel.app"; // Update with your actual Vercel URL
const LOCAL_PORT = "4000";

const getBaseUrl = () => {
  if (ENV === "prod") return PROD_URL;

  // Local logic
  if (Platform.OS === 'web') return `http://localhost:${LOCAL_PORT}`;

  // If we are on a physical device, we must use the machine's local IP
  // instead of "localhost" (which would refer to the phone itself).
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost ? debuggerHost.split(':')[0] : '192.168.1.104';
  
  return `http://${localhost}:${LOCAL_PORT}`;
};

const BASE_URL = getBaseUrl();

// Requests that stall (e.g. dead connection) should fail instead of hanging
// forever and wedging the sync engine.
const REQUEST_TIMEOUT_MS = 15000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
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
    // Network error / offline / timeout — perfectly normal in offline-first apps.
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: isTimeout ? "Request timed out" : err instanceof Error ? err.message : "Network error",
      status: 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

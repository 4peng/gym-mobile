import { USER_ID } from "@/constants/user";
import Constants from "expo-constants";

/** "prod" uses Vercel, "local" the machine's LAN IP. */
const ENV: "local" | "prod" = "prod";

const PROD_URL = "https://apen-gym.vercel.app";
const LOCAL_PORT = "4000";

const getBaseUrl = () => {
  if (ENV === "prod") return PROD_URL;

  // A physical device needs the machine's LAN IP; "localhost" would be the phone.
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost ? debuggerHost.split(":")[0] : "192.168.1.104";

  return `http://${localhost}:${LOCAL_PORT}`;
};

const BASE_URL = getBaseUrl();

// Stalled requests fail instead of wedging the sync engine.
const REQUEST_TIMEOUT_MS = 15000;

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: number;
}

/** JSON fetch with the userId header; never throws, failures return `{ ok: false }`. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
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

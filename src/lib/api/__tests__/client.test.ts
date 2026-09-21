// ──────────────────────────────────────────────
// TEST-010: API client tests
// ──────────────────────────────────────────────

import { apiRequest } from "@/lib/api/client";

// Mock the expected return from the module-level fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("@/constants/user", () => ({
  USER_ID: "test-user",
}));

// Mock expo-constants and Platform
jest.mock("expo-constants", () => ({
  expoConfig: { hostUri: "localhost:8081" },
  default: { expoConfig: { hostUri: "localhost:8081" } },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("apiRequest", () => {
  it("successful request returns { ok: true, data } with parsed JSON", async () => {
    const responseData = { message: "hello" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn(() => Promise.resolve(responseData)),
      text: jest.fn(() => Promise.resolve("")),
    });

    const result = await apiRequest<typeof responseData>("/test");
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(responseData);
    expect(result.status).toBe(200);
  });

  it("non-2xx response returns { ok: false, status } with error body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn(() => Promise.reject(new Error("Not JSON"))),
      text: jest.fn(() => Promise.resolve("Not found")),
    });

    const result = await apiRequest("/not-found");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Not found");
  });

  it("timeout (>15s) returns { ok: false, status: 0 } with timeout message", async () => {
    // Simulate an AbortError (which AbortController throws on .abort())
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await apiRequest("/timeout");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBe("Request timed out");
  });

  it("network error (fetch throws) returns { ok: false, status: 0 }", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network request failed"));

    const result = await apiRequest("/network-error");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBe("Network request failed");
  });

  it("JSON parse error from non-JSON response returns appropriate error", async () => {
    // Non-2xx response (e.g. 502 gateway error) returns text
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: jest.fn(() => Promise.reject(new Error("Not JSON"))),
      text: jest.fn(() => Promise.resolve("Bad Gateway")),
    });

    const result = await apiRequest("/bad-gateway");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.error).toBe("Bad Gateway");
  });
});

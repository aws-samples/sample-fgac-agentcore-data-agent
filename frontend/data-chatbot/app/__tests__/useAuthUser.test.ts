import { renderHook, waitFor } from "@testing-library/react";
import { useAuthUser } from "@/app/hooks/useAuthUser";

// Mock aws-amplify/auth
jest.mock("aws-amplify/auth", () => ({
  fetchAuthSession: jest.fn(),
  fetchUserAttributes: jest.fn(),
}));

import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";

const mockFetchAuthSession = fetchAuthSession as jest.MockedFunction<
  typeof fetchAuthSession
>;
const mockFetchUserAttributes = fetchUserAttributes as jest.MockedFunction<
  typeof fetchUserAttributes
>;

describe("useAuthUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null initially while loading", () => {
    mockFetchAuthSession.mockReturnValue(new Promise(() => {})); // never resolves
    mockFetchUserAttributes.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuthUser());
    expect(result.current).toBeNull();
  });

  it("returns AuthUser with tokens and attributes after loading", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "access-token-123" } as any,
        idToken: { toString: () => "id-token-456" } as any,
      },
    } as any);

    mockFetchUserAttributes.mockResolvedValue({
      sub: "user-sub-789",
      email: "alice@example.com",
      preferred_username: "alice",
      "custom:team": "Team A",
      "custom:role": "admin",
    } as any);

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toEqual({
      username: "alice",
      email: "alice@example.com",
      team: "Team A",
      customAttributes: {
        "custom:team": "Team A",
        "custom:role": "admin",
      },
      accessToken: "access-token-123",
      idToken: "id-token-456",
    });
  });

  it("falls back to sub when preferred_username is missing", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "at" } as any,
        idToken: { toString: () => "it" } as any,
      },
    } as any);

    mockFetchUserAttributes.mockResolvedValue({
      sub: "sub-fallback",
      email: "bob@example.com",
      "custom:team": "Team B",
    } as any);

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current!.username).toBe("sub-fallback");
  });

  it("handles missing custom:team gracefully", async () => {
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "at" } as any,
        idToken: { toString: () => "it" } as any,
      },
    } as any);

    mockFetchUserAttributes.mockResolvedValue({
      sub: "user-1",
      email: "user@example.com",
    } as any);

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current!.team).toBe("");
    expect(result.current!.customAttributes).toEqual({});
  });

  it("returns null when auth session fails", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("Not authenticated"));
    mockFetchUserAttributes.mockRejectedValue(new Error("Not authenticated"));

    const { result } = renderHook(() => useAuthUser());

    // Give it time to settle — should remain null
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
  });
});

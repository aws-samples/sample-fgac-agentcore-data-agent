// Feature: chatbot-frontend, Property 1: Token extraction from session
// **Validates: Requirements 1.5**

import fc from "fast-check";
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

describe("Property 1: Token extraction from session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return both accessToken and idToken as non-empty strings matching session values", async () => {
    // Property-based test with 100 runs needs extended timeout
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (accessToken, idToken) => {
          jest.clearAllMocks();

          mockFetchAuthSession.mockResolvedValue({
            tokens: {
              accessToken: { toString: () => accessToken } as any,
              idToken: { toString: () => idToken } as any,
            },
          } as any);

          mockFetchUserAttributes.mockResolvedValue({
            sub: "test-user",
            email: "test@example.com",
          } as any);

          const { result, unmount } = renderHook(() => useAuthUser());

          await waitFor(() => {
            expect(result.current).not.toBeNull();
          });

          // Both tokens must be non-empty strings
          expect(typeof result.current!.accessToken).toBe("string");
          expect(typeof result.current!.idToken).toBe("string");
          expect(result.current!.accessToken.length).toBeGreaterThan(0);
          expect(result.current!.idToken.length).toBeGreaterThan(0);

          // Tokens must match the session values
          expect(result.current!.accessToken).toBe(accessToken);
          expect(result.current!.idToken).toBe(idToken);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});

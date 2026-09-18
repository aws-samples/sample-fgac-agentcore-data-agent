// Feature: chatbot-frontend, Property 2: Account panel renders all user attributes

import React from "react";
import fc from "fast-check";
import { render, screen, cleanup } from "@testing-library/react";
import TopBar from "@/app/components/TopBar";
import type { AuthUser } from "@/app/types";

/**
 * Arbitrary: generates a non-empty alphanumeric string.
 */
const arbAlphanumeric = (min = 1, max = 20): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-Z0-9]+$/, { minLength: min, maxLength: max });

/**
 * Arbitrary: generates an email-like string (user@domain.tld).
 */
const arbEmail = (): fc.Arbitrary<string> =>
  fc
    .tuple(arbAlphanumeric(1, 10), arbAlphanumeric(1, 8), arbAlphanumeric(2, 4))
    .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/**
 * Arbitrary: generates 0–5 custom attribute key-value pairs with alphanumeric values.
 */
const arbCustomAttributes = (): fc.Arbitrary<Record<string, string>> =>
  fc
    .array(
      fc.tuple(
        arbAlphanumeric(1, 15).map((k) => `custom:${k}`),
        arbAlphanumeric(1, 20)
      ),
      { minLength: 0, maxLength: 5 }
    )
    .map((pairs) => Object.fromEntries(pairs));

/**
 * Arbitrary: generates a random AuthUser object.
 */
const arbAuthUser = (): fc.Arbitrary<AuthUser> =>
  fc.record({
    username: arbAlphanumeric(1, 20),
    email: arbEmail(),
    team: arbAlphanumeric(1, 15),
    customAttributes: arbCustomAttributes(),
    accessToken: arbAlphanumeric(10, 40),
    idToken: arbAlphanumeric(10, 40),
  });

// Feature: chatbot-frontend, Property 2: Account panel renders all user attributes
// **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
describe("Property 2: Account panel renders all user attributes", () => {
  afterEach(() => {
    cleanup();
  });

  it("account-panel contains username, email, team, and every custom attribute value", () => {
    fc.assert(
      fc.property(arbAuthUser(), (user) => {
        const { unmount } = render(
          <TopBar user={user} onMenuToggle={() => {}} isMobile={false} />
        );

        const panel = screen.getByTestId("account-panel");
        const content = panel.textContent || "";

        // Username must be rendered
        expect(content).toContain(user.username);

        // Email must be rendered
        expect(content).toContain(user.email);

        // Team must be rendered
        expect(content).toContain(user.team);

        // Every custom attribute value must be rendered
        for (const value of Object.values(user.customAttributes)) {
          expect(content).toContain(value);
        }

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

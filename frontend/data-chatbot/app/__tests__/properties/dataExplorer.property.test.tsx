// Feature: chatbot-frontend, Property 3: Database tree structure
// Feature: chatbot-frontend, Property 4: Database node toggle
// Feature: chatbot-frontend, Property 5: Schema fetch error propagation
// Feature: chatbot-frontend, Property 6: Refresh reloads schema

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";
import DataExplorer from "@/app/components/DataExplorer";
import NotificationProvider from "@/app/components/NotificationProvider";
import type { DatabaseNode } from "@/app/types";

/**
 * Arbitrary: generates an alphanumeric name starting with a letter (1-12 chars).
 */
const arbName = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/);

/**
 * Arbitrary: generates a DatabaseNode with a random name and 1-3 unique tables.
 */
const arbDatabaseNode = (): fc.Arbitrary<DatabaseNode> =>
  fc.record({
    name: arbName(),
    tables: fc.uniqueArray(arbName(), { minLength: 1, maxLength: 3 }),
  });

/**
 * Arbitrary: generates a list of 1-3 DatabaseNodes with unique names.
 */
const arbDatabaseNodes = (): fc.Arbitrary<DatabaseNode[]> =>
  fc.uniqueArray(arbDatabaseNode(), {
    minLength: 1,
    maxLength: 3,
    selector: (db) => db.name,
  });

/**
 * Helper: wraps component in NotificationProvider.
 */
function renderWithNotifications(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

/**
 * Helper: creates a mock SchemaClient whose fetchSchema resolves with the given data.
 */
function makeMockSchemaClient(data: DatabaseNode[]) {
  return { fetchSchema: jest.fn().mockResolvedValue(data) };
}

// Feature: chatbot-frontend, Property 3: Database tree structure
// **Validates: Requirements 3.3**
describe("Property 3: Database tree structure", () => {
  it("renders each database as a node with data-testid db-node-{name}", async () => {
    await fc.assert(
      fc.asyncProperty(arbDatabaseNodes(), async (databases) => {
        const client = makeMockSchemaClient(databases);
        const { unmount } = renderWithNotifications(
          <DataExplorer schemaClient={client as any} />
        );

        await waitFor(() => {
          for (const db of databases) {
            expect(screen.getByTestId(`db-node-${db.name}`)).toBeInTheDocument();
          }
        });

        unmount();
      }),
      { numRuns: 20 }
    );
  });
});

// Feature: chatbot-frontend, Property 4: Database node toggle
// **Validates: Requirements 3.4**
describe("Property 4: Database node toggle", () => {
  it("click node once → tables visible, click again → tables hidden", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbDatabaseNode().filter((db) => db.tables.length > 0),
        async (db) => {
          const client = makeMockSchemaClient([db]);
          const user = userEvent.setup();
          const { unmount } = renderWithNotifications(
            <DataExplorer schemaClient={client as any} />
          );

          await waitFor(() => {
            expect(screen.getByTestId(`db-node-${db.name}`)).toBeInTheDocument();
          });

          // Tables should NOT be visible initially
          for (const table of db.tables) {
            expect(
              screen.queryByTestId(`table-${db.name}-${table}`)
            ).not.toBeInTheDocument();
          }

          // Click to expand → tables visible
          await user.click(screen.getByTestId(`db-node-${db.name}`));
          for (const table of db.tables) {
            expect(
              screen.getByTestId(`table-${db.name}-${table}`)
            ).toBeInTheDocument();
          }

          // Click again to collapse → tables hidden
          await user.click(screen.getByTestId(`db-node-${db.name}`));
          for (const table of db.tables) {
            expect(
              screen.queryByTestId(`table-${db.name}-${table}`)
            ).not.toBeInTheDocument();
          }

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: chatbot-frontend, Property 5: Schema fetch error propagation
// **Validates: Requirements 3.5**
describe("Property 5: Schema fetch error propagation", () => {
  it("error message from fetchSchema appears in notification", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate error messages that are long enough to be unique across iterations
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{4,49}$/),
        async (errorMsg) => {
          const client = {
            fetchSchema: jest.fn().mockRejectedValue(new Error(errorMsg)),
          };
          const { unmount } = renderWithNotifications(
            <DataExplorer schemaClient={client as any} />
          );

          // Use role="alert" to scope to the notification container
          await waitFor(() => {
            const alerts = screen.getAllByRole("alert");
            const found = alerts.some((el) =>
              el.textContent?.includes(errorMsg)
            );
            expect(found).toBe(true);
          });

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

// Feature: chatbot-frontend, Property 6: Refresh reloads schema
// **Validates: Requirements 3.7**
describe("Property 6: Refresh reloads schema", () => {
  it("after refresh, updated schema is displayed and old schema is gone", async () => {
    // Use two disjoint name pools so schemas never overlap
    const arbFirstSchema = (): fc.Arbitrary<DatabaseNode[]> =>
      fc.uniqueArray(
        fc.record({
          name: fc.stringMatching(/^a[a-z0-9]{1,6}$/),
          tables: fc.uniqueArray(fc.stringMatching(/^a[a-z0-9]{1,6}$/), {
            minLength: 1,
            maxLength: 3,
          }),
        }),
        { minLength: 1, maxLength: 3, selector: (db) => db.name }
      );

    const arbSecondSchema = (): fc.Arbitrary<DatabaseNode[]> =>
      fc.uniqueArray(
        fc.record({
          name: fc.stringMatching(/^z[a-z0-9]{1,6}$/),
          tables: fc.uniqueArray(fc.stringMatching(/^z[a-z0-9]{1,6}$/), {
            minLength: 1,
            maxLength: 3,
          }),
        }),
        { minLength: 1, maxLength: 3, selector: (db) => db.name }
      );

    await fc.assert(
      fc.asyncProperty(
        arbFirstSchema(),
        arbSecondSchema(),
        async (firstSchema, secondSchema) => {
          const fetchSchema = jest
            .fn()
            .mockResolvedValueOnce(firstSchema)
            .mockResolvedValueOnce(secondSchema);
          const client = { fetchSchema };
          const user = userEvent.setup();

          const { unmount } = renderWithNotifications(
            <DataExplorer schemaClient={client as any} />
          );

          // Wait for first schema to render
          await waitFor(() => {
            for (const db of firstSchema) {
              expect(
                screen.getByTestId(`db-node-${db.name}`)
              ).toBeInTheDocument();
            }
          });

          // Click refresh
          await user.click(screen.getByTestId("refresh-button"));

          // Wait for second schema to render
          await waitFor(() => {
            for (const db of secondSchema) {
              expect(
                screen.getByTestId(`db-node-${db.name}`)
              ).toBeInTheDocument();
            }
          });

          // Verify old schema nodes are gone
          for (const db of firstSchema) {
            expect(
              screen.queryByTestId(`db-node-${db.name}`)
            ).not.toBeInTheDocument();
          }

          expect(fetchSchema).toHaveBeenCalledTimes(2);

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

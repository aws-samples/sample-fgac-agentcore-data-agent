// Feature: chatbot-frontend, Property 16: HTTP error notification
// Feature: chatbot-frontend, Property 17: Notification auto-dismiss
// Feature: chatbot-frontend, Property 18: Notification manual close

import React from "react";
import fc from "fast-check";
import { render, screen, act, fireEvent } from "@testing-library/react";
import NotificationProvider, {
  useNotifications,
} from "@/app/components/NotificationProvider";

// Mock crypto.randomUUID for deterministic IDs
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  jest.spyOn(crypto, "randomUUID").mockImplementation(() => {
    uuidCounter++;
    return `test-uuid-${uuidCounter}`;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Helper component that exposes addNotification / removeNotification
 * via buttons so we can trigger them from tests.
 */
function TestConsumer({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useNotifications>) => void;
}) {
  const api = useNotifications();
  React.useEffect(() => {
    onReady(api);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// Feature: chatbot-frontend, Property 16: HTTP error notification
// **Validates: Requirements 7.1, 7.2**
describe("Property 16: HTTP error notification", () => {
  it("notification contains both the status code and the error message for any 4xx/5xx code", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (statusCode, message) => {
          let api: ReturnType<typeof useNotifications> | null = null;

          const { unmount } = render(
            <NotificationProvider>
              <TestConsumer onReady={(a) => (api = a)} />
            </NotificationProvider>
          );

          act(() => {
            api!.addNotification({
              type: "error",
              statusCode,
              message,
            });
          });

          const container = screen.getByTestId("notification-container");
          const content = container.textContent || "";

          // Notification must contain the status code
          expect(content).toContain(String(statusCode));
          // Notification must contain the error message
          expect(content).toContain(message);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: chatbot-frontend, Property 17: Notification auto-dismiss
// **Validates: Requirements 7.4**
describe("Property 17: Notification auto-dismiss", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("notification is automatically removed after 8 seconds", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("error" as const, "warning" as const, "info" as const),
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
        (type, message) => {
          uuidCounter = 0;
          let api: ReturnType<typeof useNotifications> | null = null;

          const { unmount } = render(
            <NotificationProvider>
              <TestConsumer onReady={(a) => (api = a)} />
            </NotificationProvider>
          );

          // Add notification
          act(() => {
            api!.addNotification({ type, message });
          });

          // Notification should be present
          const notifEl = screen.getByTestId("notification-test-uuid-1");
          expect(notifEl).toBeInTheDocument();

          // Advance timers by 8 seconds
          act(() => {
            jest.advanceTimersByTime(8000);
          });

          // Notification should be removed
          expect(
            screen.queryByTestId("notification-test-uuid-1")
          ).not.toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: chatbot-frontend, Property 18: Notification manual close
// **Validates: Requirements 7.5**
describe("Property 18: Notification manual close", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("clicking the close button immediately removes the notification", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("error" as const, "warning" as const, "info" as const),
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
        (type, message) => {
          uuidCounter = 0;
          let api: ReturnType<typeof useNotifications> | null = null;

          const { unmount } = render(
            <NotificationProvider>
              <TestConsumer onReady={(a) => (api = a)} />
            </NotificationProvider>
          );

          // Add notification
          act(() => {
            api!.addNotification({ type, message });
          });

          // Notification should be present
          expect(
            screen.getByTestId("notification-test-uuid-1")
          ).toBeInTheDocument();

          // Click the close button
          const closeBtn = screen.getByTestId("notification-close-test-uuid-1");
          fireEvent.click(closeBtn);

          // Notification should be removed immediately
          expect(
            screen.queryByTestId("notification-test-uuid-1")
          ).not.toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

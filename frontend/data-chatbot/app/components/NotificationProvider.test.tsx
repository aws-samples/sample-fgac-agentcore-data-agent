import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationProvider, {
  useNotifications,
} from "./NotificationProvider";

// Mock crypto.randomUUID
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  jest.useFakeTimers();
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `test-uuid-${++uuidCounter}`,
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// Helper component that exposes notification actions for testing
function TestConsumer() {
  const { notifications, addNotification, removeNotification } =
    useNotifications();
  return (
    <div>
      <button
        data-testid="add-error"
        onClick={() =>
          addNotification({
            type: "error",
            statusCode: 500,
            message: "Server error",
          })
        }
      />
      <button
        data-testid="add-warning"
        onClick={() =>
          addNotification({ type: "warning", message: "Watch out" })
        }
      />
      <button
        data-testid="add-info"
        onClick={() =>
          addNotification({ type: "info", message: "FYI" })
        }
      />
      <span data-testid="count">{notifications.length}</span>
    </div>
  );
}

describe("NotificationProvider", () => {
  it("renders children", () => {
    render(
      <NotificationProvider>
        <div data-testid="child">Hello</div>
      </NotificationProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("adds a notification and renders it", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-error").click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByText("Server error")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it("renders notification type and statusCode", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-error").click();
    });

    // Type label with status code is rendered
    expect(screen.getByText(/error.*500/i)).toBeInTheDocument();
  });

  it("renders notification without statusCode", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-warning").click();
    });

    expect(screen.getByText("Watch out")).toBeInTheDocument();
  });

  it("removes a notification via close button", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-error").click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");

    const closeBtn = screen.getByLabelText("Close notification");
    await user.click(closeBtn);

    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("auto-dismisses notification after 8 seconds", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-info").click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");

    // Advance 7.9s — still present
    act(() => {
      jest.advanceTimersByTime(7900);
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    // Advance past 8s — dismissed
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("renders in top-right fixed overlay", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    const container = screen.getByTestId("notification-container");
    expect(container).toHaveStyle({ position: "fixed" });
  });

  it("supports multiple notifications", () => {
    render(
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByTestId("add-error").click();
      screen.getByTestId("add-warning").click();
      screen.getByTestId("add-info").click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("3");
  });
});

describe("useNotifications", () => {
  it("throws when used outside provider", () => {
    // Suppress console.error for expected error
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    function BadConsumer() {
      useNotifications();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "useNotifications must be used within a NotificationProvider"
    );

    spy.mockRestore();
  });
});

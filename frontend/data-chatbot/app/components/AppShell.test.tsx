import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import AppShell from "./AppShell";
import type { AuthUser } from "@/app/types";

// --- Mocks ---

const mockUser: AuthUser = {
  username: "testuser",
  email: "test@example.com",
  team: "Team A",
  customAttributes: { "custom:team": "Team A" },
  accessToken: "access-token-123",
  idToken: "id-token-456",
};

let mockAuthUser: AuthUser | null = mockUser;
jest.mock("@/app/hooks/useAuthUser", () => ({
  useAuthUser: () => mockAuthUser,
}));

let mockIsMobile = false;
jest.mock("@/app/hooks/useResponsive", () => ({
  useResponsive: () => ({ isMobile: mockIsMobile, viewportWidth: mockIsMobile ? 600 : 1200 }),
}));

jest.mock("@/app/lib/sessionStorage", () => ({
  loadSessions: jest.fn(() => []),
  saveSessions: jest.fn(),
  loadMessages: jest.fn(() => []),
  saveMessages: jest.fn(),
}));

const mockInvoke = jest.fn();
jest.mock("@/app/lib/agentCoreClient", () => ({
  AgentCoreClient: jest.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
  })),
}));

jest.mock("@/app/lib/schemaClient", () => ({
  SchemaClient: jest.fn().mockImplementation(() => ({
    fetchSchema: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("@/app/lib/parseMarkdownTable", () => ({
  parseMarkdownTable: jest.fn(() => null),
}));

// Mock child components to isolate AppShell wiring
let capturedChatPanelProps: Record<string, unknown> = {};
jest.mock("@/app/components/TopBar", () => {
  return function MockTopBar(props: Record<string, unknown>) {
    return (
      <div data-testid="topbar">
        <button data-testid="menu-toggle" onClick={props.onMenuToggle as () => void}>
          Menu
        </button>
      </div>
    );
  };
});

jest.mock("@/app/components/LeftSidebar", () => {
  return function MockLeftSidebar(props: Record<string, unknown>) {
    return props.isOpen || !props.isMobile ? (
      <div data-testid="left-sidebar">
        <button data-testid="new-chat-btn" onClick={props.onNewChat as () => void}>
          New Chat
        </button>
      </div>
    ) : null;
  };
});

jest.mock("@/app/components/ChatPanel", () => {
  return function MockChatPanel(props: Record<string, unknown>) {
    capturedChatPanelProps = props;
    return (
      <div data-testid="chat-panel">
        <button
          data-testid="send-btn"
          onClick={() => (props.onSendMessage as (t: string) => void)("Hello agent")}
        >
          Send
        </button>
        <button
          data-testid="data-click-btn"
          onClick={() =>
            (props.onDataClick as (d: unknown) => void)({
              columns: ["a"],
              rows: [{ a: 1 }],
            })
          }
        >
          Data
        </button>
        {(props.isLoading as boolean) && <span data-testid="loading-indicator">Loading</span>}
      </div>
    );
  };
});

jest.mock("@/app/components/VisualizationDrawer", () => {
  return function MockVisualizationDrawer(props: Record<string, unknown>) {
    return props.isOpen ? (
      <div data-testid="visualization-drawer">
        <button data-testid="drawer-close" onClick={props.onClose as () => void}>
          Close
        </button>
      </div>
    ) : null;
  };
});

// Provide crypto.randomUUID in jsdom
beforeAll(() => {
  let counter = 0;
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `uuid-${++counter}`,
    },
    writable: true,
  });
});

beforeEach(() => {
  mockAuthUser = mockUser;
  mockIsMobile = false;
  mockInvoke.mockReset();
  capturedChatPanelProps = {};
  jest.clearAllMocks();
});

describe("AppShell", () => {
  it("renders loading state when user is not yet available", () => {
    mockAuthUser = null;
    render(<AppShell />);
    const shell = screen.getByTestId("app-shell");
    expect(shell).toBeInTheDocument();
    expect(shell.textContent).toContain("Loading");
  });

  it("renders the full layout when user is available", () => {
    render(<AppShell />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("uses data-testid='app-shell' on the container", () => {
    render(<AppShell />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("loads sessions from localStorage on mount", () => {
    const { loadSessions } = require("@/app/lib/sessionStorage");
    loadSessions.mockReturnValue([
      { id: "s1", label: "Old Chat", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
    ]);
    render(<AppShell />);
    expect(loadSessions).toHaveBeenCalledWith("testuser");
  });

  it("opens visualization drawer when data is clicked", async () => {
    render(<AppShell />);
    expect(screen.queryByTestId("visualization-drawer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("data-click-btn"));
    expect(screen.getByTestId("visualization-drawer")).toBeInTheDocument();
  });

  it("closes visualization drawer when close is clicked", () => {
    render(<AppShell />);
    fireEvent.click(screen.getByTestId("data-click-btn"));
    expect(screen.getByTestId("visualization-drawer")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(screen.queryByTestId("visualization-drawer")).not.toBeInTheDocument();
  });

  it("creates a new chat session when New Chat is clicked", () => {
    const { saveSessions } = require("@/app/lib/sessionStorage");
    render(<AppShell />);
    fireEvent.click(screen.getByTestId("new-chat-btn"));
    expect(saveSessions).toHaveBeenCalled();
  });

  it("sends a message and streams response", async () => {
    // Simulate an async generator that yields chunks
    async function* fakeStream() {
      yield "Hello ";
      yield "world";
    }
    mockInvoke.mockReturnValue(fakeStream());

    // Need an active session first
    const { loadSessions } = require("@/app/lib/sessionStorage");
    loadSessions.mockReturnValue([
      { id: "s1", label: "Chat", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
    ]);

    render(<AppShell />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-btn"));
    });

    // The invoke should have been called
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Hello agent",
          accessToken: "access-token-123",
          idToken: "id-token-456",
        })
      );
    });
  });

  it("shows error notification on stream failure", async () => {
    const { AgentCoreError } = require("@/app/lib/errors");
    mockInvoke.mockImplementation(async function* () {
      throw new AgentCoreError(500, "Server error");
    });

    const { loadSessions } = require("@/app/lib/sessionStorage");
    loadSessions.mockReturnValue([
      { id: "s1", label: "Chat", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
    ]);

    render(<AppShell />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("send-btn"));
    });

    // The notification should appear (rendered by NotificationProvider)
    await waitFor(() => {
      const container = screen.getByTestId("notification-container");
      expect(container.textContent).toContain("Server error");
    });
  });
});

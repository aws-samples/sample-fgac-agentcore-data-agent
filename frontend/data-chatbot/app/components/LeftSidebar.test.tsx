import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LeftSidebar from "./LeftSidebar";
import type { ChatSession } from "@/app/types";

// Mock child components to isolate LeftSidebar behavior
jest.mock("@/app/components/DataExplorer", () => {
  return function MockDataExplorer() {
    return <div data-testid="data-explorer">DataExplorer</div>;
  };
});

jest.mock("@/app/components/SessionPanel", () => {
  return function MockSessionPanel() {
    return <div data-testid="session-panel">SessionPanel</div>;
  };
});

const mockSchemaClient = { fetchSchema: jest.fn() } as any;

const sessions: ChatSession[] = [
  { id: "s1", label: "Chat 1", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
];

const defaultProps = {
  isOpen: false,
  onClose: jest.fn(),
  schemaClient: mockSchemaClient,
  sessions,
  activeSessionId: "s1",
  onSelectSession: jest.fn(),
  onNewChat: jest.fn(),
  isMobile: false,
};

describe("LeftSidebar", () => {
  it("renders the sidebar on desktop", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
  });

  it("renders DataExplorer and SessionPanel", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.getByTestId("data-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("session-panel")).toBeInTheDocument();
  });

  it("renders as fixed-width sidebar on desktop", () => {
    render(<LeftSidebar {...defaultProps} />);
    const sidebar = screen.getByTestId("left-sidebar");
    expect(sidebar).toHaveStyle({ width: "280px" });
    expect(sidebar).toHaveStyle({ position: "relative" });
  });

  it("does not render backdrop on desktop", () => {
    render(<LeftSidebar {...defaultProps} />);
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
  });

  it("does not render on mobile when closed", () => {
    render(<LeftSidebar {...defaultProps} isMobile={true} isOpen={false} />);
    expect(screen.queryByTestId("left-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
  });

  it("renders as overlay with backdrop on mobile when open", () => {
    render(<LeftSidebar {...defaultProps} isMobile={true} isOpen={true} />);
    expect(screen.getByTestId("left-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-backdrop")).toBeInTheDocument();
    const sidebar = screen.getByTestId("left-sidebar");
    expect(sidebar).toHaveStyle({ position: "fixed" });
  });

  it("calls onClose when backdrop is clicked on mobile", () => {
    const onClose = jest.fn();
    render(<LeftSidebar {...defaultProps} isMobile={true} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("sidebar-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a divider between DataExplorer and SessionPanel", () => {
    render(<LeftSidebar {...defaultProps} />);
    const sidebar = screen.getByTestId("left-sidebar");
    const children = Array.from(sidebar.children);
    // 3 children: DataExplorer wrapper, divider, SessionPanel wrapper
    expect(children).toHaveLength(3);
  });
});

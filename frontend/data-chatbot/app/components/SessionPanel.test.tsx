import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SessionPanel from "./SessionPanel";
import type { ChatSession } from "@/app/types";

const makeSessions = (): ChatSession[] => [
  { id: "s1", label: "First chat", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-03T00:00:00Z" },
  { id: "s2", label: "Second chat", createdAt: "2024-01-02T00:00:00Z", updatedAt: "2024-01-04T00:00:00Z" },
  { id: "s3", label: "Third chat", createdAt: "2024-01-03T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
];

describe("SessionPanel", () => {
  it("renders the session panel container", () => {
    render(
      <SessionPanel sessions={[]} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    expect(screen.getByTestId("session-panel")).toBeInTheDocument();
  });

  it("renders the New Chat button", () => {
    render(
      <SessionPanel sessions={[]} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    expect(screen.getByTestId("new-chat-button")).toBeInTheDocument();
    expect(screen.getByTestId("new-chat-button")).toHaveTextContent("New Chat");
  });

  it("calls onNewChat when New Chat button is clicked", () => {
    const onNewChat = jest.fn();
    render(
      <SessionPanel sessions={[]} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={onNewChat} />
    );
    fireEvent.click(screen.getByTestId("new-chat-button"));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("renders sessions sorted by updatedAt descending", () => {
    const sessions = makeSessions();
    render(
      <SessionPanel sessions={sessions} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    const entries = screen.getAllByTestId(/^session-entry-/);
    // s2 (Jan 4) > s1 (Jan 3) > s3 (Jan 1)
    expect(entries[0]).toHaveAttribute("data-testid", "session-entry-s2");
    expect(entries[1]).toHaveAttribute("data-testid", "session-entry-s1");
    expect(entries[2]).toHaveAttribute("data-testid", "session-entry-s3");
  });

  it("displays session labels", () => {
    const sessions = makeSessions();
    render(
      <SessionPanel sessions={sessions} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Second chat")).toBeInTheDocument();
    expect(screen.getByText("Third chat")).toBeInTheDocument();
  });

  it("highlights the active session with a different background", () => {
    const sessions = makeSessions();
    render(
      <SessionPanel sessions={sessions} activeSessionId="s1" onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    const active = screen.getByTestId("session-entry-s1");
    expect(active).toHaveStyle({ background: "rgba(0, 112, 243, 0.12)" });
    const inactive = screen.getByTestId("session-entry-s2");
    expect(inactive).toHaveStyle({ background: "transparent" });
  });

  it("calls onSelectSession with session id when clicked", () => {
    const sessions = makeSessions();
    const onSelect = jest.fn();
    render(
      <SessionPanel sessions={sessions} activeSessionId={null} onSelectSession={onSelect} onNewChat={jest.fn()} />
    );
    fireEvent.click(screen.getByTestId("session-entry-s1"));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("renders empty list when no sessions", () => {
    render(
      <SessionPanel sessions={[]} activeSessionId={null} onSelectSession={jest.fn()} onNewChat={jest.fn()} />
    );
    const entries = screen.queryAllByTestId(/^session-entry-/);
    expect(entries).toHaveLength(0);
  });
});

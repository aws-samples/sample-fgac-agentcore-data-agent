import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageList from "./MessageList";
import type { ChatMessage, StructuredData } from "@/app/types";

// Mock scrollIntoView
const scrollIntoViewMock = jest.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

const sampleData: StructuredData = {
  columns: ["id", "name"],
  rows: [{ id: 1, name: "Alice" }],
};

const baseMessages: ChatMessage[] = [
  { id: "m1", role: "user", content: "Hello", timestamp: "2024-01-01T00:00:00Z" },
  { id: "m2", role: "assistant", content: "Hi there!", timestamp: "2024-01-01T00:00:01Z" },
];

describe("MessageList", () => {
  const onDataClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the message list container with data-testid", () => {
    render(
      <MessageList messages={[]} streamingContent="" onDataClick={onDataClick} />
    );
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
  });

  it("renders user and assistant messages with correct test ids and classes", () => {
    render(
      <MessageList messages={baseMessages} streamingContent="" onDataClick={onDataClick} />
    );
    const userMsg = screen.getByTestId("message-m1");
    const assistantMsg = screen.getByTestId("message-m2");

    expect(userMsg).toHaveClass("message-user");
    expect(assistantMsg).toHaveClass("message-assistant");
    expect(userMsg).toHaveTextContent("Hello");
    expect(assistantMsg).toHaveTextContent("Hi there!");
  });

  it("renders user messages right-aligned and assistant messages left-aligned", () => {
    render(
      <MessageList messages={baseMessages} streamingContent="" onDataClick={onDataClick} />
    );
    const userMsg = screen.getByTestId("message-m1");
    const assistantMsg = screen.getByTestId("message-m2");

    expect(userMsg).toHaveStyle({ alignSelf: "flex-end" });
    expect(assistantMsg).toHaveStyle({ alignSelf: "flex-start" });
  });

  it("renders View Data button when message has structuredData", () => {
    const messages: ChatMessage[] = [
      {
        id: "m3",
        role: "assistant",
        content: "Here is data",
        timestamp: "2024-01-01T00:00:02Z",
        structuredData: sampleData,
      },
    ];
    render(
      <MessageList messages={messages} streamingContent="" onDataClick={onDataClick} />
    );
    const btn = screen.getByTestId("view-data-m3");
    expect(btn).toHaveTextContent("View Data");
  });

  it("calls onDataClick with structuredData when View Data is clicked", () => {
    const messages: ChatMessage[] = [
      {
        id: "m3",
        role: "assistant",
        content: "Here is data",
        timestamp: "2024-01-01T00:00:02Z",
        structuredData: sampleData,
      },
    ];
    render(
      <MessageList messages={messages} streamingContent="" onDataClick={onDataClick} />
    );
    fireEvent.click(screen.getByTestId("view-data-m3"));
    expect(onDataClick).toHaveBeenCalledWith(sampleData);
  });

  it("does not render View Data button when message has no structuredData", () => {
    render(
      <MessageList messages={baseMessages} streamingContent="" onDataClick={onDataClick} />
    );
    expect(screen.queryByTestId("view-data-m1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-data-m2")).not.toBeInTheDocument();
  });

  it("renders streaming content as a partial assistant message", () => {
    render(
      <MessageList
        messages={baseMessages}
        streamingContent="Thinking..."
        onDataClick={onDataClick}
      />
    );
    const streaming = screen.getByTestId("streaming-message");
    expect(streaming).toHaveClass("message-assistant");
    expect(streaming).toHaveTextContent("Thinking...");
  });

  it("does not render streaming message when streamingContent is empty", () => {
    render(
      <MessageList messages={baseMessages} streamingContent="" onDataClick={onDataClick} />
    );
    expect(screen.queryByTestId("streaming-message")).not.toBeInTheDocument();
  });

  it("calls scrollIntoView when messages change", () => {
    const { rerender } = render(
      <MessageList messages={baseMessages} streamingContent="" onDataClick={onDataClick} />
    );
    scrollIntoViewMock.mockClear();

    const newMessages = [
      ...baseMessages,
      { id: "m4", role: "user" as const, content: "New msg", timestamp: "2024-01-01T00:00:03Z" },
    ];
    rerender(
      <MessageList messages={newMessages} streamingContent="" onDataClick={onDataClick} />
    );
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it("renders empty state with no messages", () => {
    render(
      <MessageList messages={[]} streamingContent="" onDataClick={onDataClick} />
    );
    const container = screen.getByTestId("message-list");
    // Only the scroll anchor div should be present
    expect(container.querySelectorAll("[data-testid^='message-']")).toHaveLength(0);
  });
});

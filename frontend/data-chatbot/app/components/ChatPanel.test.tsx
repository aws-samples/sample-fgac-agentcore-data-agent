import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatPanel from "./ChatPanel";
import type { ChatMessage, StructuredData } from "@/app/types";

// Mock scrollIntoView since jsdom doesn't support it
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe("ChatPanel", () => {
  const baseProps = {
    messages: [] as ChatMessage[],
    streamingContent: "",
    isLoading: false,
    onSendMessage: jest.fn(),
    onDataClick: jest.fn(),
  };

  it("renders with data-testid chat-panel", () => {
    render(<ChatPanel {...baseProps} />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("renders MessageList and ChatInput", () => {
    render(<ChatPanel {...baseProps} />);
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("passes messages and streamingContent to MessageList", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Hello", timestamp: new Date().toISOString() },
      { id: "2", role: "assistant", content: "Hi there", timestamp: new Date().toISOString() },
    ];
    render(
      <ChatPanel {...baseProps} messages={messages} streamingContent="streaming..." />
    );
    expect(screen.getByTestId("message-1")).toBeInTheDocument();
    expect(screen.getByTestId("message-2")).toBeInTheDocument();
    expect(screen.getByTestId("streaming-message")).toHaveTextContent("streaming...");
  });

  it("passes isLoading to ChatInput (disables send)", () => {
    render(<ChatPanel {...baseProps} isLoading={true} />);
    const textarea = screen.getByTestId("chat-textarea") as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();
  });

  it("calls onSendMessage when ChatInput sends", () => {
    const onSendMessage = jest.fn();
    render(<ChatPanel {...baseProps} onSendMessage={onSendMessage} />);
    const textarea = screen.getByTestId("chat-textarea");
    fireEvent.change(textarea, { target: { value: "test message" } });
    fireEvent.click(screen.getByTestId("send-button"));
    expect(onSendMessage).toHaveBeenCalledWith("test message");
  });

  it("passes onDataClick to MessageList for structured data", () => {
    const onDataClick = jest.fn();
    const data: StructuredData = { columns: ["a"], rows: [{ a: 1 }] };
    const messages: ChatMessage[] = [
      { id: "d1", role: "assistant", content: "result", timestamp: new Date().toISOString(), structuredData: data },
    ];
    render(<ChatPanel {...baseProps} messages={messages} onDataClick={onDataClick} />);
    fireEvent.click(screen.getByTestId("view-data-d1"));
    expect(onDataClick).toHaveBeenCalledWith(data);
  });

  it("container is a flex column taking full height", () => {
    render(<ChatPanel {...baseProps} />);
    const panel = screen.getByTestId("chat-panel");
    expect(panel.style.display).toBe("flex");
    expect(panel.style.flexDirection).toBe("column");
    expect(panel.style.height).toBe("100%");
  });
});

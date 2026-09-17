import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatInput from "./ChatInput";

describe("ChatInput", () => {
  const onSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders container, textarea, and send button with correct test ids", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("send-button")).toBeInTheDocument();
  });

  it("calls onSend with trimmed text on button click and clears input", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");
    const button = screen.getByTestId("send-button");

    fireEvent.change(textarea, { target: { value: "  hello world  " } });
    fireEvent.click(button);

    expect(onSend).toHaveBeenCalledWith("hello world");
    expect(textarea).toHaveValue("");
  });

  it("calls onSend on Enter key (without Shift) and clears input", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");

    fireEvent.change(textarea, { target: { value: "test message" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledWith("test message");
    expect(textarea).toHaveValue("");
  });

  it("does not send on Shift+Enter (allows newline)", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");

    fireEvent.change(textarea, { target: { value: "line one" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("line one");
  });

  it("does not send empty or whitespace-only messages via button", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    const button = screen.getByTestId("send-button");

    // Empty
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();

    // Whitespace only
    fireEvent.change(screen.getByTestId("chat-textarea"), { target: { value: "   " } });
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send empty or whitespace-only messages via Enter", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables textarea and shows spinner text when isLoading=true", () => {
    render(<ChatInput isLoading={true} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");
    const button = screen.getByTestId("send-button");

    expect(textarea).toBeDisabled();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("...");
  });

  it("textarea is visually greyed out when loading", () => {
    render(<ChatInput isLoading={true} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");
    expect(textarea).toHaveStyle({ background: "#f0f0f0" });
  });

  it("shows 'Send' text when not loading", () => {
    render(<ChatInput isLoading={false} onSend={onSend} />);
    expect(screen.getByTestId("send-button")).toHaveTextContent("Send");
  });

  it("does not call onSend when loading even if text is present", () => {
    render(<ChatInput isLoading={true} onSend={onSend} />);
    const textarea = screen.getByTestId("chat-textarea");

    fireEvent.change(textarea, { target: { value: "test" } });
    fireEvent.click(screen.getByTestId("send-button"));
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("returns to active state when isLoading transitions from true to false", () => {
    const { rerender } = render(<ChatInput isLoading={true} onSend={onSend} />);
    expect(screen.getByTestId("chat-textarea")).toBeDisabled();
    expect(screen.getByTestId("send-button")).toBeDisabled();

    rerender(<ChatInput isLoading={false} onSend={onSend} />);
    expect(screen.getByTestId("chat-textarea")).not.toBeDisabled();
    expect(screen.getByTestId("send-button")).toHaveTextContent("Send");
  });
});

"use client";

import React from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { ChatMessage, StructuredData } from "@/app/types";

export interface ChatPanelProps {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onDataClick: (data: StructuredData) => void;
}

export default function ChatPanel({
  messages, streamingContent, isLoading, onSendMessage, onDataClick,
}: ChatPanelProps) {
  const showSuggestions = messages.length === 0 && !streamingContent;

  return (
    <div data-testid="chat-panel" style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--surface-chat)",
    }}>
      <MessageList messages={messages} streamingContent={streamingContent}
        onDataClick={onDataClick} />
      {isLoading && !streamingContent && (
        <div data-testid="loading-indicator" style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 28px", color: "var(--text-muted)", fontSize: 13,
        }}>
          <span style={{
            display: "inline-block", width: 16, height: 16,
            border: "2px solid var(--border-light)", borderTopColor: "var(--accent)",
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }} />
          Agent is thinking…
        </div>
      )}
      <ChatInput isLoading={isLoading} onSend={onSendMessage}
        showSuggestions={showSuggestions} />
    </div>
  );
}

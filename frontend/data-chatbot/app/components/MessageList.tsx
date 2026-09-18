"use client";

import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import DataAgentLogo from "@/app/components/DataAgentLogo";
import type { ChatMessage, StructuredData } from "@/app/types";

/**
 * Ensure markdown tables and headings have proper blank line spacing.
 * Tables need a blank line BEFORE the first row, but NO blank lines between rows.
 */
function fixMarkdownSpacing(text: string): string {
  // Split into lines, find table blocks, ensure blank line before first table line
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTableLine = line.trimStart().startsWith("|");
    const prevLine = i > 0 ? lines[i - 1] : "";
    const prevIsTableLine = prevLine.trimStart().startsWith("|");
    const prevIsBlank = prevLine.trim() === "";

    // Add blank line before the first table row (but not between table rows)
    if (isTableLine && !prevIsTableLine && !prevIsBlank) {
      result.push("");
    }

    // Add blank line before headings if previous line isn't blank
    if (/^#{1,3} /.test(line) && !prevIsBlank && i > 0) {
      result.push("");
    }

    result.push(line);
  }

  return result.join("\n");
}

export interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  onDataClick: (data: StructuredData) => void;
}

export default function MessageList({
  messages, streamingContent, onDataClick,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div data-testid="message-list" style={{
      flex: 1, overflowY: "auto", padding: "24px 28px",
      display: "flex", flexDirection: "column", gap: "18px",
    }}>
      {messages.length === 0 && !streamingContent && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
          color: "var(--text-muted)", paddingBottom: 60,
        }}>
          <DataAgentLogo size={48} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
            FGAC Data Agent
          </div>
          <div style={{ fontSize: 13, maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
            Ask questions about your data. Access is scoped to your team.
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <div key={msg.id} data-testid={`message-${msg.id}`}
          className={msg.role === "user" ? "message-user" : "message-assistant"}
          style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: msg.role === "user" ? "65%" : "88%",
            padding: msg.role === "user" ? "10px 16px" : "16px 20px",
            borderRadius: msg.role === "user"
              ? "var(--radius-xl) var(--radius-xl) 4px var(--radius-xl)"
              : "4px var(--radius-xl) var(--radius-xl) var(--radius-xl)",
            fontSize: 14, lineHeight: 1.6, boxSizing: "border-box",
            ...(msg.role === "user"
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--surface-card)", color: "var(--text-primary)",
                  border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)" }),
          }}>
          <div style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
            {msg.role === "assistant" ? (
              <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{fixMarkdownSpacing(msg.content)}</ReactMarkdown></div>
            ) : (
              <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            )}
          </div>
          {msg.structuredData && (
            <button data-testid={`view-data-${msg.id}`}
              onClick={() => onDataClick(msg.structuredData!)}
              style={{
                marginTop: 10, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: msg.role === "user" ? "rgba(255,255,255,0.2)" : "var(--accent)",
                color: "#fff", border: "none", borderRadius: 8,
                cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >📊 View Data</button>
          )}
        </div>
      ))}

      {streamingContent && (
        <div data-testid="streaming-message" className="message-assistant" style={{
          alignSelf: "flex-start", maxWidth: "88%",
          padding: "16px 20px",
          borderRadius: "4px var(--radius-xl) var(--radius-xl) var(--radius-xl)",
          fontSize: 14, lineHeight: 1.6,
          background: "var(--surface-card)", color: "var(--text-primary)",
          border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)",
          boxSizing: "border-box",
        }}>
          <div style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
            <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{fixMarkdownSpacing(streamingContent)}</ReactMarkdown></div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

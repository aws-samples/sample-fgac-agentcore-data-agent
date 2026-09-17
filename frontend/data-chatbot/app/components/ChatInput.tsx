"use client";

import React, { useState, useCallback } from "react";

const SAMPLE_QUESTIONS = [
  { label: "Count sales by team", prompt: "Query the sales_extended table and count the number of rows grouped by team" },
  { label: "Show all tables", prompt: "Show me all the tables available in the tickit2 database" },
  { label: "First 5 venues", prompt: "Show me the first 5 venues from the venue table" },
  { label: "All categories", prompt: "Show me all categories from the category table" },
  { label: "Show databases", prompt: "Show me all databases" },
];

export interface ChatInputProps {
  isLoading: boolean;
  onSend: (text: string) => void;
  showSuggestions?: boolean;
}

export default function ChatInput({ isLoading, onSend, showSuggestions }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText("");
  }, [text, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }, [handleSend]
  );

  const hasText = text.trim().length > 0;

  return (
    <div data-testid="chat-input" style={{
      padding: "12px 20px 16px",
      borderTop: "1px solid var(--border-light)",
      background: "var(--surface-card)",
    }}>
      {/* Sample question chips — always visible, fill textbox on click */}
      {!isLoading && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10,
        }}>
          {SAMPLE_QUESTIONS.map((q) => (
            <button key={q.label} onClick={() => { setText(q.prompt); }}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 500,
                background: "var(--surface-input)", color: "var(--text-secondary)",
                border: "1px solid var(--border-light)", borderRadius: 20,
                cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "var(--accent-soft)";
                e.currentTarget.style.color = "var(--accent)";
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "var(--surface-input)";
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.borderColor = "var(--border-light)";
              }}
            >{q.label}</button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <textarea data-testid="chat-textarea" value={text}
          onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
          disabled={isLoading} placeholder="Ask about your data…" rows={2}
          style={{
            flex: 1, resize: "none", padding: "10px 14px",
            fontSize: 14, lineHeight: 1.5, borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)", outline: "none",
            fontFamily: "inherit", transition: "all 0.15s",
            ...(isLoading
              ? { background: "var(--surface-input)", color: "var(--text-muted)", cursor: "not-allowed" }
              : { background: "var(--surface-input-focus)", color: "var(--text-primary)" }),
          }}
          onFocus={e => { if (!isLoading) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "var(--shadow-glow)"; } }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.boxShadow = "none"; }}
        />
        <button data-testid="send-button" onClick={handleSend} disabled={isLoading}
          style={{
            padding: "10px 18px", fontSize: 14, fontWeight: 600,
            borderRadius: "var(--radius-md)", border: "none",
            cursor: isLoading ? "not-allowed" : "pointer",
            minWidth: 70, height: 44, display: "flex",
            alignItems: "center", justifyContent: "center",
            transition: "all 0.15s", fontFamily: "inherit",
            ...(isLoading
              ? { background: "var(--surface-input)", color: "var(--text-muted)" }
              : hasText
                ? { background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-glow)" }
                : { background: "var(--surface-input)", color: "var(--text-muted)" }),
          }}>
          {isLoading ? (
            <span style={{
              display: "inline-block", width: 18, height: 18,
              border: "2px solid var(--border-light)", borderTopColor: "var(--accent)",
              borderRadius: "50%", animation: "spin 0.7s linear infinite",
            }} />
          ) : "Send"}
        </button>
      </div>
    </div>
  );
}
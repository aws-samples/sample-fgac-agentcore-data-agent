"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Notification } from "@/app/types";

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "createdAt">) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export default function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (n: Omit<Notification, "id" | "createdAt">) => {
      const id = crypto.randomUUID();
      const notification: Notification = {
        ...n,
        id,
        createdAt: Date.now(),
      };
      setNotifications((prev) => [...prev, notification]);

      // Longer auto-dismiss for errors with stacktraces
      const timeout = n.stacktrace ? 30000 : 8000;
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setNotifications((prev) => prev.filter((item) => item.id !== id));
      }, timeout);
      timersRef.current.set(id, timer);
    },
    []
  );

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const typeStyles: Record<Notification["type"], React.CSSProperties> = {
    error: { backgroundColor: "#fef2f2", borderLeft: "4px solid #ef4444", color: "#991b1b" },
    warning: { backgroundColor: "#fffbeb", borderLeft: "4px solid #f59e0b", color: "#92400e" },
    info: { backgroundColor: "#eff6ff", borderLeft: "4px solid #3b82f6", color: "#1e40af" },
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification }}
    >
      {children}
      {/* Notification overlay — top-right, non-blocking */}
      <div
        data-testid="notification-container"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
          maxWidth: 520,
        }}
      >
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            style={typeStyles[n.type]}
            onClose={() => removeNotification(n.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export { NotificationContext };

function NotificationItem({
  notification: n,
  style,
  onClose,
}: {
  notification: Notification;
  style: React.CSSProperties;
  onClose: () => void;
}) {
  const [traceOpen, setTraceOpen] = useState(false);

  // Parse stacktrace into structured frames
  const frames = React.useMemo(() => {
    if (!n.stacktrace) return [];
    return n.stacktrace
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const fileMatch = line.match(/File "([^"]+)", line (\d+), in (.+)/);
        if (fileMatch) {
          return { type: "frame" as const, file: fileMatch[1], line: fileMatch[2], func: fileMatch[3] };
        }
        return { type: "text" as const, content: line };
      });
  }, [n.stacktrace]);

  return (
    <div
      data-testid={`notification-${n.id}`}
      role="alert"
      style={{
        ...style,
        padding: "12px 16px",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        pointerEvents: "auto",
        animation: "slideIn 0.2s ease-out",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span>
              {n.errorType || n.type}
              {n.statusCode != null && (
                <span style={{
                  marginLeft: 6,
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 4,
                  backgroundColor: "rgba(0,0,0,0.08)",
                  fontWeight: 500,
                }}>
                  {n.statusCode}
                </span>
              )}
            </span>
          </div>
          <div style={{ lineHeight: 1.5 }}>{n.message}</div>
        </div>
        <button
          data-testid={`notification-close-${n.id}`}
          onClick={onClose}
          aria-label="Close notification"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            color: "inherit",
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Collapsible stacktrace */}
      {n.stacktrace && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setTraceOpen((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 0",
              opacity: 0.8,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{
              display: "inline-block",
              transition: "transform 0.15s",
              transform: traceOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}>
              ▶
            </span>
            Stack Trace
          </button>

          {traceOpen && (
            <div
              style={{
                marginTop: 6,
                padding: "10px 12px",
                backgroundColor: "rgba(0,0,0,0.06)",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                lineHeight: 1.6,
                maxHeight: 280,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {frames.map((frame, i) => {
                if (frame.type === "frame") {
                  // Shorten file path: show last 2 segments
                  const parts = frame.file.split("/");
                  const shortPath = parts.length > 2
                    ? "…/" + parts.slice(-2).join("/")
                    : frame.file;
                  return (
                    <div key={i} style={{ padding: "2px 0" }}>
                      <span style={{ opacity: 0.5 }}>at </span>
                      <span style={{ color: "#b91c1c", fontWeight: 600 }}>{frame.func}</span>
                      <span style={{ opacity: 0.6 }}>
                        {" "}({shortPath}:{frame.line})
                      </span>
                    </div>
                  );
                }
                // Final error line or other text
                const isErrorLine = frame.content.match(/^\w+Error:|^\w+Exception:/);
                return (
                  <div
                    key={i}
                    style={{
                      padding: "2px 0",
                      fontWeight: isErrorLine ? 700 : 400,
                      color: isErrorLine ? "#991b1b" : "inherit",
                    }}
                  >
                    {frame.content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

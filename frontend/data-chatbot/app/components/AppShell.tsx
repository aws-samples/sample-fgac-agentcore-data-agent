"use client";

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { useAuthUser } from "@/app/hooks/useAuthUser";
import { fetchAuthSession } from "aws-amplify/auth";
import { useResponsive } from "@/app/hooks/useResponsive";
import { AppProvider, useAppState } from "@/app/state/AppContext";
import NotificationProvider, {
  useNotifications,
} from "@/app/components/NotificationProvider";
import TopBar from "@/app/components/TopBar";
import LeftSidebar from "@/app/components/LeftSidebar";
import ChatPanel from "@/app/components/ChatPanel";
import VisualizationDrawer from "@/app/components/VisualizationDrawer";
import { AgentCoreClient } from "@/app/lib/agentCoreClient";
// import { SchemaClient } from "@/app/lib/schemaClient"; // Uncomment when Lambda is deployed
import { loadSessions, loadMessages, saveSessions, saveMessages } from "@/app/lib/sessionStorage";
import { parseMarkdownTable } from "@/app/lib/parseMarkdownTable";
import type { ChatMessage, StructuredData } from "@/app/types";

const agentCoreClient = new AgentCoreClient(
  process.env.NEXT_PUBLIC_AGENTCORE_REGION || "us-east-1",
  process.env.NEXT_PUBLIC_AGENT_ARN || ""
);

// Schema discovery Lambda not deployed yet — pass null to disable DataExplorer
// const schemaClient = new SchemaClient(
//   process.env.NEXT_PUBLIC_SCHEMA_LAMBDA_NAME || "schemaDiscovery"
// );
const schemaClient = null;

function AppShellInner() {
  const user = useAuthUser();
  const { isMobile } = useResponsive();
  const { state, dispatch } = useAppState();
  const { addNotification } = useNotifications();
  const streamRef = useRef("");

  // Load sessions from localStorage when user becomes available
  // Also ensure isAgentProcessing is false on mount (handles page refresh during processing)
  useEffect(() => {
    if (!user) return;
    dispatch({ type: "SET_USER", payload: user });
    dispatch({ type: "SET_AGENT_PROCESSING", payload: false });
    const sessions = loadSessions(user.username);
    dispatch({ type: "SET_SESSIONS", payload: sessions });
    if (sessions.length > 0) {
      const activeId = sessions[0].id;
      dispatch({ type: "SET_ACTIVE_SESSION", payload: activeId });
      const msgs = loadMessages(user.username, activeId);
      dispatch({ type: "SET_MESSAGES", payload: { sessionId: activeId, messages: msgs } });
    } else {
      // Auto-create a first session so the user can start chatting immediately
      const newSession = {
        id: crypto.randomUUID(),
        label: "New Chat",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_SESSION", payload: newSession });
      dispatch({ type: "SET_ACTIVE_SESSION", payload: newSession.id });
      saveSessions(user.username, [newSession]);
    }
  }, [user, dispatch]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!user || !state.activeSessionId) return;

      const sessionId = state.activeSessionId;

      // Create user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };

      const currentMessages = state.messagesBySession[sessionId] || [];
      const updatedMessages = [...currentMessages, userMessage];
      dispatch({ type: "SET_MESSAGES", payload: { sessionId, messages: updatedMessages } });

      // Update session label if first message
      if (currentMessages.length === 0) {
        const label = text.length > 40 ? text.slice(0, 40) + "…" : text;
        const updatedSessions = state.sessions.map((s) =>
          s.id === sessionId ? { ...s, label, updatedAt: new Date().toISOString() } : s
        );
        dispatch({ type: "SET_SESSIONS", payload: updatedSessions });
        saveSessions(user.username, updatedSessions);
      }

      dispatch({ type: "SET_AGENT_PROCESSING", payload: true });
      streamRef.current = "";

      try {
        // Get fresh tokens before each request — Amplify auto-refreshes if expired
        const freshSession = await fetchAuthSession();
        const freshAccessToken = freshSession.tokens?.accessToken?.toString() ?? user.accessToken;
        const freshIdToken = freshSession.tokens?.idToken?.toString() ?? user.idToken;

        const stream = agentCoreClient.invoke({
          prompt: text,
          sessionId,
          accessToken: freshAccessToken,
          idToken: freshIdToken,
        });

        for await (const chunk of stream) {
          streamRef.current += chunk;
          dispatch({ type: "APPEND_STREAMING_CONTENT", payload: chunk });
        }

        // After streaming completes, check if the accumulated content is a backend error JSON
        const fullContent = streamRef.current;
        console.log("[FULL CONTENT]", JSON.stringify(fullContent));
        const backendError = (() => {
          // Try direct parse first
          try {
            const parsed = JSON.parse(fullContent);
            if (parsed && parsed.__error__ === true) return parsed;
          } catch {
            // Not valid JSON as-is
          }
          // Try matching the error pattern in the raw text
          // (handles partially escaped JSON from SSE chunks)
          if (fullContent.includes('"__error__"') || fullContent.includes("__error__")) {
            try {
              const start = fullContent.indexOf("{");
              const end = fullContent.lastIndexOf("}");
              if (start !== -1 && end > start) {
                const jsonStr = fullContent.slice(start, end + 1);
                const parsed = JSON.parse(jsonStr);
                if (parsed && parsed.__error__ === true) return parsed;
              }
            } catch {
              // Still not parseable — treat as normal content
            }
          }
          return null;
        })();

        if (backendError) {
          // Clear the streamed error text from chat
          dispatch({ type: "APPEND_STREAMING_CONTENT", payload: "" });
          // Remove the partial message that was being displayed
          dispatch({ type: "SET_MESSAGES", payload: { sessionId, messages: updatedMessages } });
          addNotification({
            type: "error",
            statusCode: 500,
            message: backendError.message || "Unknown agent error",
            errorType: backendError.type || "Error",
            stacktrace: backendError.stacktrace || undefined,
          });
        } else {
          // Normal response — create assistant message
          const structuredData = parseMarkdownTable(fullContent);
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: fullContent,
            timestamp: new Date().toISOString(),
            ...(structuredData ? { structuredData } : {}),
          };

          const finalMessages = [...updatedMessages, assistantMessage];
          dispatch({ type: "SET_MESSAGES", payload: { sessionId, messages: finalMessages } });
          saveMessages(user.username, sessionId, finalMessages);

          // Update session updatedAt
          const sessionsAfter = state.sessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: new Date().toISOString() } : s
          );
          dispatch({ type: "SET_SESSIONS", payload: sessionsAfter });
          saveSessions(user.username, sessionsAfter);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : undefined;
        const errorType =
          err && typeof err === "object" && "errorType" in err
            ? (err as { errorType?: string }).errorType
            : undefined;
        const stacktrace =
          err && typeof err === "object" && "stacktrace" in err
            ? (err as { stacktrace?: string }).stacktrace
            : undefined;
        addNotification({
          type: "error",
          message,
          ...(statusCode ? { statusCode } : {}),
          ...(errorType ? { errorType } : {}),
          ...(stacktrace ? { stacktrace } : {}),
        });
      } finally {
        dispatch({ type: "SET_AGENT_PROCESSING", payload: false });
      }
    },
    [user, state.activeSessionId, state.messagesBySession, state.sessions, dispatch, addNotification]
  );

  const handleNewChat = useCallback(() => {
    if (!user) return;
    const newSession = {
      id: crypto.randomUUID(),
      label: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_SESSION", payload: newSession });
    dispatch({ type: "SET_ACTIVE_SESSION", payload: newSession.id });
    dispatch({ type: "SET_MESSAGES", payload: { sessionId: newSession.id, messages: [] } });
    const updatedSessions = [newSession, ...state.sessions];
    saveSessions(user.username, updatedSessions);
  }, [user, state.sessions, dispatch]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (!user) return;
      dispatch({ type: "SET_ACTIVE_SESSION", payload: id });
      const msgs = loadMessages(user.username, id);
      dispatch({ type: "SET_MESSAGES", payload: { sessionId: id, messages: msgs } });
      if (isMobile) {
        dispatch({ type: "TOGGLE_SIDEBAR" });
      }
    },
    [user, isMobile, dispatch]
  );

  const handleDataClick = useCallback(
    (data: StructuredData) => {
      dispatch({ type: "SET_DRAWER_DATA", payload: data });
    },
    [dispatch]
  );

  const handleDrawerClose = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAWER" });
  }, [dispatch]);

  const handleSidebarToggle = useCallback(() => {
    dispatch({ type: "TOGGLE_SIDEBAR" });
  }, [dispatch]);

  const activeMessages = useMemo(() => {
    if (!state.activeSessionId) return [];
    return state.messagesBySession[state.activeSessionId] || [];
  }, [state.activeSessionId, state.messagesBySession]);

  // Loading state while user is being fetched
  if (!user) {
    return (
      <div data-testid="app-shell" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontSize: 14, color: "var(--text-muted)",
        background: "var(--surface-chat)", gap: 10,
      }}>
        <span style={{
          display: "inline-block", width: 18, height: 18,
          border: "2px solid var(--border-light)", borderTopColor: "var(--accent)",
          borderRadius: "50%", animation: "spin 0.7s linear infinite",
        }} />
        Loading…
      </div>
    );
  }

  return (
    <div data-testid="app-shell" style={{
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
    }}>
      <TopBar user={user} onMenuToggle={handleSidebarToggle} isMobile={isMobile} />
      <div style={{
        display: "flex", flex: 1, marginTop: 52, overflow: "hidden",
      }}>
      >
        <LeftSidebar
          isOpen={state.sidebarOpen}
          onClose={handleSidebarToggle}
          schemaClient={schemaClient}
          sessions={state.sessions}
          activeSessionId={state.activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          isMobile={isMobile}
        />

        <div style={{ flex: 1, overflow: "hidden" }}>
          <ChatPanel
            messages={activeMessages}
            streamingContent={state.streamingContent}
            isLoading={state.isAgentProcessing}
            onSendMessage={handleSendMessage}
            onDataClick={handleDataClick}
          />
        </div>

        <VisualizationDrawer
          isOpen={state.drawerOpen}
          data={state.drawerData}
          onClose={handleDrawerClose}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <NotificationProvider>
      <AppProvider>
        <AppShellInner />
      </AppProvider>
    </NotificationProvider>
  );
}

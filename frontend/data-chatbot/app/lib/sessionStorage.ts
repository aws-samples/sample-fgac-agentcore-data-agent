import { ChatSession, ChatMessage } from '@/app/types';

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadSessions(userSub: string): ChatSession[] {
  try {
    if (!isLocalStorageAvailable()) return [];
    const raw = localStorage.getItem(`fgac-agent:${userSub}:sessions`);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

export function saveSessions(userSub: string, sessions: ChatSession[]): void {
  try {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(`fgac-agent:${userSub}:sessions`, JSON.stringify(sessions));
  } catch {
    // graceful degradation — silently ignore
  }
}

export function loadMessages(userSub: string, sessionId: string): ChatMessage[] {
  try {
    if (!isLocalStorageAvailable()) return [];
    const raw = localStorage.getItem(`fgac-agent:${userSub}:messages:${sessionId}`);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveMessages(userSub: string, sessionId: string, messages: ChatMessage[]): void {
  try {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(`fgac-agent:${userSub}:messages:${sessionId}`, JSON.stringify(messages));
  } catch {
    // graceful degradation — silently ignore
  }
}

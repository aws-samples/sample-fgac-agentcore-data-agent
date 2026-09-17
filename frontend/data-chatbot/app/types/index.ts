export interface AuthUser {
  username: string;
  sub: string;
  email: string;
  team: string;
  customAttributes: Record<string, string>;
  accessToken: string;
  idToken: string;
}

export interface ChatSession {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  structuredData?: StructuredData;
}

export interface StructuredData {
  columns: string[];
  rows: Record<string, string | number>[];
}

export interface DatabaseNode {
  name: string;
  tables: string[];
}

export interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info';
  statusCode?: number;
  message: string;
  errorType?: string;
  stacktrace?: string;
  createdAt: number;
}

export interface AppState {
  user: AuthUser | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  databases: DatabaseNode[];
  schemaLoading: boolean;
  isAgentProcessing: boolean;
  streamingContent: string;
  drawerOpen: boolean;
  drawerData: StructuredData | null;
  notifications: Notification[];
  sidebarOpen: boolean;
}

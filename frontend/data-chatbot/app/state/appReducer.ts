import type {
  AppState,
  AuthUser,
  ChatSession,
  ChatMessage,
  DatabaseNode,
  StructuredData,
  Notification,
} from '@/app/types';

export type AppAction =
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_SESSIONS'; payload: ChatSession[] }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | null }
  | { type: 'ADD_SESSION'; payload: ChatSession }
  | { type: 'SET_MESSAGES'; payload: { sessionId: string; messages: ChatMessage[] } }
  | { type: 'APPEND_STREAMING_CONTENT'; payload: string }
  | { type: 'SET_AGENT_PROCESSING'; payload: boolean }
  | { type: 'SET_DATABASES'; payload: DatabaseNode[] }
  | { type: 'SET_SCHEMA_LOADING'; payload: boolean }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'SET_DRAWER_DATA'; payload: StructuredData | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

export const initialState: AppState = {
  user: null,
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  databases: [],
  schemaLoading: false,
  isAgentProcessing: false,
  streamingContent: '',
  drawerOpen: false,
  drawerData: null,
  notifications: [],
  sidebarOpen: true,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };

    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };

    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };

    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions] };

    case 'SET_MESSAGES':
      return {
        ...state,
        messagesBySession: {
          ...state.messagesBySession,
          [action.payload.sessionId]: action.payload.messages,
        },
      };

    case 'APPEND_STREAMING_CONTENT':
      return { ...state, streamingContent: state.streamingContent + action.payload };

    case 'SET_AGENT_PROCESSING':
      return {
        ...state,
        isAgentProcessing: action.payload,
        streamingContent: action.payload ? state.streamingContent : '',
      };

    case 'SET_DATABASES':
      return { ...state, databases: action.payload };

    case 'SET_SCHEMA_LOADING':
      return { ...state, schemaLoading: action.payload };

    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: !state.drawerOpen };

    case 'SET_DRAWER_DATA':
      return { ...state, drawerData: action.payload, drawerOpen: true };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.payload),
      };

    default:
      return state;
  }
}

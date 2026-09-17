import { loadSessions, saveSessions, loadMessages, saveMessages } from './sessionStorage';
import { ChatSession, ChatMessage } from '@/app/types';

describe('sessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const userSub = 'user-123';

  const sessions: ChatSession[] = [
    { id: 's1', label: 'First chat', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T01:00:00Z' },
    { id: 's2', label: 'Second chat', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T01:00:00Z' },
  ];

  const messages: ChatMessage[] = [
    { id: 'm1', role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
    { id: 'm2', role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:00:01Z' },
  ];

  describe('loadSessions', () => {
    it('returns empty array when nothing stored', () => {
      expect(loadSessions(userSub)).toEqual([]);
    });

    it('returns stored sessions', () => {
      localStorage.setItem(`fgac-agent:${userSub}:sessions`, JSON.stringify(sessions));
      expect(loadSessions(userSub)).toEqual(sessions);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem(`fgac-agent:${userSub}:sessions`, 'not-json');
      expect(loadSessions(userSub)).toEqual([]);
    });
  });

  describe('saveSessions', () => {
    it('persists sessions to localStorage', () => {
      saveSessions(userSub, sessions);
      const raw = localStorage.getItem(`fgac-agent:${userSub}:sessions`);
      expect(JSON.parse(raw!)).toEqual(sessions);
    });
  });

  describe('loadMessages', () => {
    it('returns empty array when nothing stored', () => {
      expect(loadMessages(userSub, 's1')).toEqual([]);
    });

    it('returns stored messages for a session', () => {
      localStorage.setItem(`fgac-agent:${userSub}:messages:s1`, JSON.stringify(messages));
      expect(loadMessages(userSub, 's1')).toEqual(messages);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem(`fgac-agent:${userSub}:messages:s1`, '{broken');
      expect(loadMessages(userSub, 's1')).toEqual([]);
    });
  });

  describe('saveMessages', () => {
    it('persists messages to localStorage', () => {
      saveMessages(userSub, 's1', messages);
      const raw = localStorage.getItem(`fgac-agent:${userSub}:messages:s1`);
      expect(JSON.parse(raw!)).toEqual(messages);
    });
  });

  describe('graceful degradation', () => {
    it('loadSessions returns empty array when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadSessions(userSub)).toEqual([]);
      spy.mockRestore();
    });

    it('saveSessions does not throw when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveSessions(userSub, sessions)).not.toThrow();
      spy.mockRestore();
    });

    it('loadMessages returns empty array when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(loadMessages(userSub, 's1')).toEqual([]);
      spy.mockRestore();
    });

    it('saveMessages does not throw when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveMessages(userSub, 's1', messages)).not.toThrow();
      spy.mockRestore();
    });
  });
});

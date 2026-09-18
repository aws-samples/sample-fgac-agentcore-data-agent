import { renderHook, act } from "@testing-library/react";
import { useResponsive } from "@/app/hooks/useResponsive";

describe("useResponsive", () => {
  let matchMediaListeners: Map<string, (e: MediaQueryListEvent) => void>;
  let resizeListeners: (() => void)[];

  beforeEach(() => {
    matchMediaListeners = new Map();
    resizeListeners = [];

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => {
        const mql = {
          matches: window.innerWidth < 768,
          media: query,
          addEventListener: jest.fn(
            (_event: string, handler: (e: MediaQueryListEvent) => void) => {
              matchMediaListeners.set(query, handler);
            }
          ),
          removeEventListener: jest.fn(
            (_event: string, _handler: (e: MediaQueryListEvent) => void) => {
              matchMediaListeners.delete(query);
            }
          ),
        };
        return mql;
      }),
    });

    // Mock addEventListener/removeEventListener for resize
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = jest.fn((event: string, handler: any) => {
      if (event === "resize") {
        resizeListeners.push(handler);
      } else {
        originalAddEventListener.call(window, event, handler);
      }
    });

    window.removeEventListener = jest.fn((event: string, handler: any) => {
      if (event === "resize") {
        resizeListeners = resizeListeners.filter((h) => h !== handler);
      } else {
        originalRemoveEventListener.call(window, event, handler);
      }
    });
  });

  it("returns desktop defaults for wide viewport", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.viewportWidth).toBe(1024);
  });

  it("returns isMobile true for narrow viewport", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 500 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.viewportWidth).toBe(500);
  });

  it("updates isMobile when matchMedia fires", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });

    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(false);

    // Simulate crossing below breakpoint
    act(() => {
      const handler = matchMediaListeners.get("(max-width: 767px)");
      if (handler) {
        handler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current.isMobile).toBe(true);
  });

  it("updates viewportWidth on resize", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });

    const { result } = renderHook(() => useResponsive());
    expect(result.current.viewportWidth).toBe(1024);

    act(() => {
      Object.defineProperty(window, "innerWidth", { writable: true, value: 600 });
      resizeListeners.forEach((fn) => fn());
    });

    expect(result.current.viewportWidth).toBe(600);
  });

  it("cleans up listeners on unmount", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });

    const { unmount } = renderHook(() => useResponsive());

    unmount();

    // matchMedia listener should be removed
    expect(matchMediaListeners.size).toBe(0);
  });

  it("treats exactly 768px as desktop", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 768 });

    const { result } = renderHook(() => useResponsive());

    // 768px is NOT below 768, so isMobile should be false
    expect(result.current.isMobile).toBe(false);
    expect(result.current.viewportWidth).toBe(768);
  });

  it("treats 767px as mobile", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 767 });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.viewportWidth).toBe(767);
  });
});

export type EventCallback = (...args: unknown[]) => void;

export interface AppEventBus {
  on(event: string, callback: EventCallback): () => void;
  once(event: string, callback: EventCallback): () => void;
  off(event: string, callback: EventCallback): void;
  emit(event: string, ...args: unknown[]): void;
}

class EventBusImpl implements AppEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  once(event: string, callback: EventCallback): () => void {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      }
    }
  }
}

export function createEventBus(): AppEventBus {
  return new EventBusImpl();
}

'use client';
// A simple event emitter for client-side events.
type Listener = (data: any) => void;

class Emitter {
  private listeners: { [event: string]: Listener[] } = {};

  on(event: string, listener: Listener): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener
      );
    };
  }

  emit(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(data));
    }
  }
}

export const errorEmitter = new Emitter();

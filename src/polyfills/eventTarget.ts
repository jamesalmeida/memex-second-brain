// Polyfill for EventTarget which is required by youtubei.js but not available in React Native
if (typeof global.EventTarget === 'undefined') {
  class EventTarget {
    private listeners: { [key: string]: Function[] } = {};

    addEventListener(type: string, listener: Function) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: Function) {
      if (!this.listeners[type]) return;
      const index = this.listeners[type].indexOf(listener);
      if (index !== -1) {
        this.listeners[type].splice(index, 1);
      }
    }

    dispatchEvent(event: any) {
      if (!this.listeners[event.type]) return true;
      this.listeners[event.type].forEach(listener => listener(event));
      return true;
    }
  }

  (global as any).EventTarget = EventTarget;
}
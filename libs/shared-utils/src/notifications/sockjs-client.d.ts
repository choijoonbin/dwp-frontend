/**
 * 타입 선언 — sockjs-client 패키지에 타입이 없어 로컬 선언.
 * @stomp/stompjs webSocketFactory에 SockJS 인스턴스를 넘기기 위한 호환 타입.
 */
declare module 'sockjs-client' {
  interface SockJSInstance {
    readyState: number;
    send(data?: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  }
  interface SockJSStatic {
    new (url: string, _reserved?: unknown, options?: Record<string, unknown>): SockJSInstance;
  }
  const SockJS: SockJSStatic;
  export default SockJS;
}

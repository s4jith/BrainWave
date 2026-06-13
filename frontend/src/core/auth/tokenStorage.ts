/**
 * Token storage abstraction.
 * The Zustand userStore is the source of truth at runtime, but the HTTP
 * layer must remain decoupled from React state to avoid circular imports.
 * We register a getter at app bootstrap (see TokenBridge).
 */

type TokenGetter = () => string | null;
type LogoutHandler = () => void;

let getTokenImpl: TokenGetter = () => null;
let onUnauthorizedImpl: LogoutHandler = () => {};

export const tokenStorage = {
  registerGetter(fn: TokenGetter) {
    getTokenImpl = fn;
  },
  registerUnauthorizedHandler(fn: LogoutHandler) {
    onUnauthorizedImpl = fn;
  },
  getToken(): string | null {
    return getTokenImpl();
  },
  handleUnauthorized(): void {
    onUnauthorizedImpl();
  },
};

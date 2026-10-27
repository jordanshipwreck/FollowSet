/// <reference types="vite/client" />
declare const __BUILD_ID__: string;
interface Window {
  FITTY_GOOGLE_CLIENT_ID?: string;
  __fittyBootDone?: () => void;
  __fittyBootFail?: (e: unknown) => void;
}

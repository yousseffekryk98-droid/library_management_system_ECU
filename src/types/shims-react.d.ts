// Minimal React/JSX shims to satisfy TypeScript when @types/react is not installed.
declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FormEvent = any;

  export function useState<T>(initial?: T): [T, (v: T | ((prev: T) => T)) => void];
  export function useEffect(fn: any, deps?: any): void;
  export function useContext<T>(ctx: any): T;
  export function createContext<T>(value?: T): any;

  export const StrictMode: any;
  export const Fragment: any;

  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  export function createRoot(el: any): any;
}

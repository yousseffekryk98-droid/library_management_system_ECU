// Minimal React/JSX type surface for this repository.
// Keep this typed: declaring `module 'react'` as an empty module elsewhere
// turns hooks into `any` and breaks generic hooks/context inference.
declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FormEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type ComponentType<P = any> = (props: P) => any;

  export interface Context<T> {
    Provider: any;
    Consumer: any;
    readonly __valueType?: T;
  }

  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useState<T = undefined>(): [T | undefined, (value: T | undefined | ((prev: T | undefined) => T | undefined)) => void];
  export function useEffect(fn: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly any[]): T;
  export function useContext<T>(ctx: Context<T>): T;
  export function createContext<T>(value: T): Context<T>;

  export const StrictMode: any;
  export const Fragment: any;

  const React: {
    createElement: (...args: any[]) => any;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  export function createRoot(el: any): { render(node: any): void };
}

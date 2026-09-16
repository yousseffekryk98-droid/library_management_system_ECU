// Minimal React namespace fallback used by files that reference React.* types.
declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type FormEvent<T = any> = any;
  type ChangeEvent<T = any> = any;
  type ComponentType<P = any> = (props: P) => any;
}

// Provide a minimal React namespace to satisfy references to React types in the code
declare namespace React {
  type ReactNode = any;
  type FormEvent = any;
  type ChangeEvent<T = any> = any;
}

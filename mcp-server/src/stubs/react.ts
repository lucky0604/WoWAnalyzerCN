type ReactNode = unknown;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = ReactNode;
  export type IntrinsicElements = Record<string, unknown>;
}

export type { ReactNode };
export const Fragment = Symbol('Fragment');
export function cloneElement(_element: unknown, _props?: unknown): unknown {
  return null;
}
export default {};

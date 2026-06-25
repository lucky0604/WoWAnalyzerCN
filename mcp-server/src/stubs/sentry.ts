// eslint-disable-next-line no-empty-function
export function captureException(_err: unknown, _options?: Record<string, unknown>): void {}

export function withScope(
  fn: (scope: {
    setTag: (_tag: string, _value: string) => void;
    setExtra: (_key: string, _value: string) => void;
    setExtras: (_: Record<string, unknown>) => void;
  }) => void,
): void {
  fn({
    // eslint-disable-next-line no-empty-function
    setTag: () => {},
    // eslint-disable-next-line no-empty-function
    setExtra: () => {},
    // eslint-disable-next-line no-empty-function
    setExtras: () => {},
  });
}

export function maybeGetTalentOrSpell(
  key: string | number | undefined,
): { name: string; id: number } | undefined {
  if (typeof key === 'number') {
    return { name: 'Unknown', id: key };
  }
  return undefined;
}

const MAC_RE = /^([0-9a-fA-F]{2})[:-]([0-9a-fA-F]{2})[:-]([0-9a-fA-F]{2})[:-]([0-9a-fA-F]{2})[:-]([0-9a-fA-F]{2})[:-]([0-9a-fA-F]{2})$/;

/** Normalizes any `aa:bb:cc:dd:ee:ff` / `aa-bb-cc-dd-ee-ff` MAC to uppercase colon form, or null if not a MAC. */
export function normalizeMacAddress(raw: string): string | null {
  const match = raw.trim().match(MAC_RE);
  if (!match) return null;
  return match.slice(1, 7).join(":").toUpperCase();
}

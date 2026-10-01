export type SortDirection = 'asc' | 'desc';

export interface BedLabel {
  /** Numeric bed number, or null when the source records no bed. */
  number: number | null;
  /** The label exactly as the source recorded it, e.g. "1", "SIP.14", "Sans lit". */
  label: string;
}

/**
 * Bed labels arrive from the source as free text and are not uniform. Observed
 * shapes: bare numbers ("1"), a prefixed number ("SIP.14"), and a
 * "no bed assigned" marker ("Sans lit"). Taking the first digit run handles all
 * three and stays correct if another prefix appears.
 */
export function parseBedLabel(picuId?: string | null): BedLabel {
  const label = (picuId ?? '').trim();
  const digits = label.match(/\d+/);
  return { number: digits ? Number(digits[0]) : null, label };
}

/**
 * Render a bed label for display.
 *
 * Purely numeric labels keep the "#01" form the table has always used.
 * Anything else is shown verbatim, because flattening "SIP.14" to "#14" makes it
 * indistinguishable from a different ward's "14". A label the source recorded
 * as "Sans lit" is real data, not a missing measurement, so it is not replaced
 * with an em dash; the dash is reserved for a genuinely empty label.
 */
export function formatBedLabel(picuId?: string | null): string {
  const { number, label } = parseBedLabel(picuId);
  if (number === null) return label || '—';
  return /^\d+$/.test(label) ? `#${label.padStart(2, '0')}` : label;
}

/**
 * Order two bed labels.
 *
 * Labels without a number always sort last, in both directions: the direction
 * multiplier is applied only to the numeric comparison, so reversing the list
 * never floats unassigned beds to the top. Equal numbers tie-break on the raw
 * label, which keeps "2" and "SIP.2" in a stable relative order; remaining ties
 * are left to the sort's stability.
 */
export function compareBeds(
  a?: string | null,
  b?: string | null,
  direction: SortDirection = 'asc',
): number {
  const left = parseBedLabel(a);
  const right = parseBedLabel(b);

  if (left.number === null || right.number === null) {
    if (left.number === right.number) return left.label.localeCompare(right.label, 'fr');
    return left.number === null ? 1 : -1;
  }

  if (left.number !== right.number) {
    return (left.number - right.number) * (direction === 'asc' ? 1 : -1);
  }
  return left.label.localeCompare(right.label, 'fr');
}
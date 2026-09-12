/**
 * Substitutes `{name}` placeholders in a string catalogue entry.
 *
 * The house rule is that every user-facing string lives in `SoteriaStrings`.
 * Standard-specific copy ("ISO 45001 clause") would break that rule once the
 * platform supports more than one standard, so those entries are stored as
 * templates and resolved at render time against the active standard.
 *
 * Placeholders with no matching key are left untouched rather than replaced
 * with "undefined", so a missing value degrades to visible, debuggable copy.
 *
 * @example
 * interpolate('{standard} clause', { standard: 'ISO 14001' }); // "ISO 14001 clause"
 */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : value;
  });
}

/**
 * Catch near-miss email domains before a code is sent into nowhere.
 *
 * A typo here is expensive in a way it is not elsewhere. It creates a real
 * account, sends a code to an address that cannot receive it, and leaves an
 * orphan profile behind. It happened on the first evening: `gmail.con`.
 *
 * Deliberately narrow. Only single-character slips against the handful of
 * domains this house actually uses, so a real address at an unusual domain is
 * never second-guessed. Suggesting corrections to correct addresses is worse
 * than missing a typo, because people learn to dismiss the warning.
 */

const COMMON_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'];

/** True when one insertion, deletion or substitution turns `a` into `b`. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let slips = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++slips > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }

  return slips + (a.length - i) + (b.length - j) <= 1;
}

/** The address they probably meant, or null when it looks fine. */
export function closeMiss(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;

  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_DOMAINS.includes(domain)) return null;

  for (const known of COMMON_DOMAINS) {
    if (withinOneEdit(domain, known)) return `${email.slice(0, at)}@${known}`;
  }
  return null;
}

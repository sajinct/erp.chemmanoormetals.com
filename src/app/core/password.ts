/** Same limits the admin "Create user" screen and its server function enforce. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

function lengthProblem(next: string): string | null {
  if (next.length < PASSWORD_MIN)
    return `Use at least ${PASSWORD_MIN} characters for the new password.`;
  if (next.length > PASSWORD_MAX)
    return `Use at most ${PASSWORD_MAX} characters for the new password.`;
  return null;
}

/**
 * Checks a new password typed twice (reset by email, where there is no current
 * password to compare with). Returns what is wrong, or null when it is fine.
 */
export function passwordChoiceProblem(next: string, confirm: string): string | null {
  return lengthProblem(next) ?? (next !== confirm ? 'The two new passwords do not match.' : null);
}

/**
 * Checks a requested password change before anything is sent to the server.
 * Returns what is wrong, in words for the person typing, or null when it is fine.
 */
export function newPasswordProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  const length = lengthProblem(next);
  if (length) return length;
  if (next === current) return 'The new password must be different from the current one.';
  if (next !== confirm) return 'The two new passwords do not match.';
  return null;
}

/** A random password for an admin to hand to a staff member: 40 characters, mixed classes. */
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return 'Aa7!' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

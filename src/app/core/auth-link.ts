/** What an emailed sign-in link brought the visitor here to do. */
export interface AuthLink {
  /** True when a valid "reset your password" link was followed. */
  recovery: boolean;
  /** Set when the link was refused, for example because it expired or was already used. */
  error: string | null;
}

/**
 * Reads the outcome Supabase attaches to the address after an emailed link is
 * clicked. It arrives after the "#" (or, in some setups, after the "?").
 */
export function readAuthLink(href: string): AuthLink {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { recovery: false, error: null };
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [key, value] of url.searchParams) if (!params.has(key)) params.set(key, value);
  const failed = params.has('error_code') || params.has('error_description');
  return {
    recovery: !failed && params.get('type') === 'recovery',
    error: failed ? params.get('error_description') || 'The link could not be used.' : null,
  };
}

/**
 * Captured when the app's code first loads, before the Supabase client or the
 * router can rewrite the address.
 */
export const AUTH_LINK: AuthLink =
  typeof window === 'undefined'
    ? { recovery: false, error: null }
    : readAuthLink(window.location.href);

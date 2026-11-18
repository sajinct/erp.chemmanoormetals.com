import { readAuthLink } from './auth-link';

describe('readAuthLink', () => {
  const site = 'https://erp.chemmanoormetals.com/';

  it('recognises a followed password reset link', () => {
    expect(
      readAuthLink(`${site}#access_token=abc&refresh_token=def&expires_in=3600&type=recovery`),
    ).toEqual({ recovery: true, error: null });
  });

  it('reports an expired or reused link instead of starting a reset', () => {
    expect(
      readAuthLink(
        `${site}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=recovery`,
      ),
    ).toEqual({ recovery: false, error: 'Email link is invalid or has expired' });
  });

  it('also reads an error sent as a query string', () => {
    expect(readAuthLink(`${site}?error=access_denied&error_code=otp_expired`)).toEqual({
      recovery: false,
      error: 'The link could not be used.',
    });
  });

  it('ignores ordinary visits, other link types and customer quote links', () => {
    const none = { recovery: false, error: null };
    expect(readAuthLink(site)).toEqual(none);
    expect(readAuthLink(`${site}leads/123`)).toEqual(none);
    expect(readAuthLink(`${site}?q=Ab3xK9pQw2`)).toEqual(none);
    expect(readAuthLink(`${site}#access_token=abc&type=signup`)).toEqual(none);
    expect(readAuthLink('not a url')).toEqual(none);
  });
});

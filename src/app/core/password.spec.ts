import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Auth } from './auth';
import { generatePassword, newPasswordProblem, passwordChoiceProblem } from './password';
import { Supabase } from './supabase';

describe('newPasswordProblem', () => {
  const good = 'correct horse battery';

  it('accepts a long, different, matching password', () => {
    expect(newPasswordProblem('old-password', good, good)).toBeNull();
  });

  it('explains each thing that can be wrong', () => {
    expect(newPasswordProblem('', good, good)).toBe('Enter your current password.');
    expect(newPasswordProblem('old-password', 'short', 'short')).toBe(
      'Use at least 12 characters for the new password.',
    );
    expect(newPasswordProblem('old-password', 'x'.repeat(129), 'x'.repeat(129))).toBe(
      'Use at most 128 characters for the new password.',
    );
    expect(newPasswordProblem(good, good, good)).toBe(
      'The new password must be different from the current one.',
    );
    expect(newPasswordProblem('old-password', good, good + '!')).toBe(
      'The two new passwords do not match.',
    );
  });
});

describe('passwordChoiceProblem', () => {
  it('checks length and that both entries match', () => {
    expect(passwordChoiceProblem('correct horse battery', 'correct horse battery')).toBeNull();
    expect(passwordChoiceProblem('short', 'short')).toBe(
      'Use at least 12 characters for the new password.',
    );
    expect(passwordChoiceProblem('correct horse battery', 'correct horse')).toBe(
      'The two new passwords do not match.',
    );
  });
});

describe('generatePassword', () => {
  it('makes long, different passwords that satisfy the length rule', () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^Aa7![0-9a-f]{36}$/);
    expect(passwordChoiceProblem(a, a)).toBeNull();
  });
});

describe('Auth passwords', () => {
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let updateUser: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let resetPasswordForEmail: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let announce: (event: string) => void;
  let session: { user: { id: string; email: string } } | null;

  const auth = () => TestBed.inject(Auth);

  beforeEach(() => {
    sessionStorage.clear();
    session = { user: { id: 'staff-id', email: 'staff@example.com' } };
    resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    navigateByUrl = vi.fn().mockResolvedValue(true);
    signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
    updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
    signOut = vi.fn().mockResolvedValue({ error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: Supabase,
          useValue: {
            client: {
              auth: {
                getSession: async () => ({ data: { session } }),
                onAuthStateChange: (listener: (event: string) => void) => {
                  announce = listener;
                  return { data: { subscription: { unsubscribe() {} } } };
                },
                resetPasswordForEmail,
                signInWithPassword,
                updateUser,
                signOut,
              },
              // Profile lookup after a sign-in or a completed reset.
              from: () => ({
                select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
              }),
            },
          },
        },
      ],
    });
  });

  it('checks the current password, sets the new one and signs out other devices', async () => {
    expect(await auth().changePassword('old-password', 'new-long-password')).toBeNull();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'staff@example.com',
      password: 'old-password',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-long-password' });
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('does not change anything when the current password is wrong', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { status: 400, message: 'Invalid login credentials' },
    });
    expect(await auth().changePassword('wrong', 'new-long-password')).toBe(
      'Your current password is not correct.',
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('passes on the server reason when the new password is refused', async () => {
    updateUser.mockResolvedValue({ data: {}, error: { message: 'Password is too weak.' } });
    expect(await auth().changePassword('old-password', 'new-long-password')).toBe(
      'Password is too weak.',
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it('still reports success if ending other sessions fails', async () => {
    signOut.mockRejectedValue(new Error('network'));
    expect(await auth().changePassword('old-password', 'new-long-password')).toBeNull();
  });

  it('asks for a fresh sign-in when there is no session', async () => {
    session = null;
    expect(await auth().changePassword('old-password', 'new-long-password')).toBe(
      'Your session has ended. Sign in again, then change your password.',
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('emails a reset link that returns to the live app', async () => {
    expect(await auth().requestPasswordReset('staff@example.com')).toBeNull();
    expect(resetPasswordForEmail).toHaveBeenCalledWith('staff@example.com', {
      redirectTo: 'https://erp.chemmanoormetals.com',
    });
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'Too many requests' } });
    expect(await auth().requestPasswordReset('staff@example.com')).toBe('Too many requests');
  });

  it('sends someone who followed a reset link to choose a password, and finishes there', async () => {
    const service = auth();
    expect(service.recovering()).toBe(false);
    announce('PASSWORD_RECOVERY');
    expect(service.recovering()).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/reset-password');

    expect(await service.completeRecovery('new-long-password')).toBeNull();
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-long-password' });
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(service.recovering()).toBe(false);
    expect(service.signedIn()).toBe(true);
  });

  it('keeps the reset pending when the new password is refused', async () => {
    const service = auth();
    announce('PASSWORD_RECOVERY');
    updateUser.mockResolvedValue({ data: {}, error: { message: 'Password is too weak.' } });
    expect(await service.completeRecovery('new-long-password')).toBe('Password is too weak.');
    expect(service.recovering()).toBe(true);
  });

  it('refuses to finish a reset without the signed-in session the link provides', async () => {
    session = null;
    expect(await auth().completeRecovery('new-long-password')).toBe(
      'This reset link has expired. Request a new one from the sign-in page.',
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('ignores other sign-in events', () => {
    const service = auth();
    announce('SIGNED_IN');
    announce('TOKEN_REFRESHED');
    expect(service.recovering()).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});

export const USER_ROLES = ['admin', 'approver', 'sales', 'measurement', 'accounts'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export interface StaffProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
}
export interface ProfileChanges {
  full_name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
}
export interface CreateStaff extends ProfileChanges {
  email: string;
  password: string;
}
export interface UserManagementServices {
  authenticate(token: string): Promise<{ id: string } | null>;
  getProfile(id: string): Promise<StaffProfile | null>;
  create(input: CreateStaff): Promise<StaffProfile>;
  update(id: string, changes: ProfileChanges): Promise<StaffProfile>;
  /** Sets a new password and ends every existing sign-in of that user. */
  resetPassword(id: string, password: string): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validPassword = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 12 && value.length <= 128;

export class UserManagementError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Authentication and validation are shared with tests; privileged SDK access stays in index.ts. */
export function userManagementHandler(
  services: UserManagementServices,
  appOrigin = 'https://erp.chemmanoormetals.com',
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const allowed =
      !origin || origin === appOrigin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': allowed ? origin || appOrigin : appOrigin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return json(403, { error: 'This origin is not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json(405, { error: 'Use POST for user management.' });
    try {
      const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
      if (!token) return json(401, { error: 'Please sign in again.' });
      const caller = await services.authenticate(token);
      if (!caller) return json(401, { error: 'Your session has expired. Please sign in again.' });
      const admin = await services.getProfile(caller.id);
      if (!admin?.active || admin.role !== 'admin')
        return json(403, { error: 'Only active administrators can manage users.' });

      const text = await request.text();
      if (text.length > 8192) return json(413, { error: 'The user details are too large.' });
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(text);
      } catch {
        return json(400, { error: 'Send valid user details.' });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return json(400, { error: 'Send valid user details.' });
      if (!['create', 'update', 'reset_password'].includes(body['action'] as string))
        return json(400, { error: 'Choose create, update or reset_password.' });
      if (body['action'] === 'reset_password') {
        const id = body['id'];
        if (typeof id !== 'string' || !UUID.test(id))
          return json(400, { error: 'Choose a valid user.' });
        // An admin's own password goes through "Change password", which asks
        // for the current one; this route would let a borrowed session skip that.
        if (id === caller.id)
          return json(409, {
            error: 'Use Change password in your account menu for your own password.',
          });
        if (!validPassword(body['password']))
          return json(400, { error: 'Use a new password between 12 and 128 characters.' });
        const target = await services.getProfile(id);
        if (!target) return json(404, { error: 'This user no longer exists.' });
        await services.resetPassword(id, body['password']);
        return json(200, { user: target });
      }
      const name = typeof body['full_name'] === 'string' ? body['full_name'].trim() : '';
      const phone = typeof body['phone'] === 'string' ? body['phone'].trim() : '';
      const role = body['role'];
      if (!name || name.length > 120)
        return json(400, { error: 'Enter a name of up to 120 characters.' });
      if (phone.length > 30)
        return json(400, { error: 'Enter a phone number of up to 30 characters.' });
      if (!USER_ROLES.includes(role as UserRole) || typeof body['active'] !== 'boolean')
        return json(400, { error: 'Choose a valid role and account status.' });
      const changes: ProfileChanges = {
        full_name: name,
        phone: phone || null,
        role: role as UserRole,
        active: body['active'],
      };
      if (body['action'] === 'create') {
        const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : '';
        const password = body['password'];
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return json(400, { error: 'Enter a valid email address.' });
        if (!validPassword(password))
          return json(400, { error: 'Use an initial password between 12 and 128 characters.' });
        const user = await services.create({ ...changes, email, password });
        return json(201, { user });
      }
      const id = body['id'];
      if (typeof id !== 'string' || !UUID.test(id))
        return json(400, { error: 'Choose a valid user.' });
      const target = await services.getProfile(id);
      if (!target) return json(404, { error: 'This user no longer exists.' });
      if (id === caller.id && (changes.role !== target.role || changes.active !== target.active))
        return json(409, { error: 'You cannot change your own role or disable your own account.' });
      return json(200, { user: await services.update(id, changes) });
    } catch (error) {
      if (error instanceof UserManagementError) return json(error.status, { error: error.message });
      return json(500, { error: 'User management is temporarily unavailable. Please try again.' });
    }
  };
}

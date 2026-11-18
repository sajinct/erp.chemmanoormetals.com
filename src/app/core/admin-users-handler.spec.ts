import { vi } from 'vitest';
import {
  userManagementHandler,
  UserManagementError,
  UserManagementServices,
  StaffProfile,
} from '../../../supabase/functions/manage-users/handler';

const adminId = '00000000-0000-0000-0000-000000000001';
const staffId = '00000000-0000-0000-0000-000000000002';
const admin: StaffProfile = {
  id: adminId,
  full_name: 'Administrator',
  email: 'admin@example.com',
  phone: null,
  role: 'admin',
  active: true,
};
const staff: StaffProfile = {
  ...admin,
  id: staffId,
  full_name: 'Staff member',
  email: 'staff@example.com',
  role: 'sales',
};
const input = {
  action: 'create',
  full_name: 'New Staff',
  email: 'new@example.com',
  phone: null,
  role: 'measurement',
  active: true,
  password: 'InitialPassword7!',
};

describe('Admin user-management API', () => {
  let services: UserManagementServices;
  const request = (
    body: unknown,
    token = 'valid-token',
    origin = 'https://erp.chemmanoormetals.com',
  ) =>
    new Request('https://example.com/manage-users', {
      method: 'POST',
      headers: {
        authorization: token ? `Bearer ${token}` : '',
        origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  beforeEach(() => {
    services = {
      authenticate: vi.fn().mockResolvedValue({ id: adminId }),
      getProfile: vi.fn(async (id: string) =>
        id === adminId ? admin : id === staffId ? staff : null,
      ),
      create: vi.fn().mockResolvedValue(staff),
      update: vi.fn().mockResolvedValue(staff),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('rejects missing and invalid sessions without performing privileged actions', async () => {
    const handler = userManagementHandler(services);
    expect((await handler(request(input, ''))).status).toBe(401);
    vi.mocked(services.authenticate).mockResolvedValueOnce(null);
    expect((await handler(request(input, 'invalid'))).status).toBe(401);
    expect(services.create).not.toHaveBeenCalled();
  });

  it.each(['sales', 'measurement', 'accounts', 'approver'])(
    'blocks a %s caller even when the request asks for admin access',
    async (role) => {
      vi.mocked(services.getProfile).mockResolvedValueOnce({
        ...admin,
        role: role as StaffProfile['role'],
      });
      expect(
        (await userManagementHandler(services)(request({ ...input, role: 'admin' }))).status,
      ).toBe(403);
      expect(services.create).not.toHaveBeenCalled();
    },
  );

  it('blocks an inactive admin with a valid Auth session', async () => {
    vi.mocked(services.getProfile).mockResolvedValueOnce({ ...admin, active: false });
    expect((await userManagementHandler(services)(request(input))).status).toBe(403);
  });

  it('creates only validated staff fields and never returns the password', async () => {
    const response = await userManagementHandler(services)(
      request({
        ...input,
        full_name: ' New Staff ',
        email: ' NEW@EXAMPLE.COM ',
        app_metadata: { forged: true },
        id: adminId,
      }),
    );
    expect(response.status).toBe(201);
    expect(services.create).toHaveBeenCalledWith({
      full_name: 'New Staff',
      email: 'new@example.com',
      phone: null,
      role: 'measurement',
      active: true,
      password: input.password,
    });
    expect(await response.text()).not.toContain(input.password);
  });

  it.each([
    { password: 'short' },
    { password: 'x'.repeat(129) },
    { email: 'invalid' },
    { role: 'owner' },
    { active: 'true' },
    { full_name: ' ' },
    { phone: 'x'.repeat(31) },
  ])('rejects invalid create values %o', async (change) => {
    expect((await userManagementHandler(services)(request({ ...input, ...change }))).status).toBe(
      400,
    );
    expect(services.create).not.toHaveBeenCalled();
  });

  it('prevents changing your own role or access while allowing your contact details', async () => {
    const handler = userManagementHandler(services);
    const own = { ...input, action: 'update', id: adminId, role: 'admin' };
    expect((await handler(request({ ...own, role: 'sales' }))).status).toBe(409);
    expect((await handler(request({ ...own, active: false }))).status).toBe(409);
    expect(services.update).not.toHaveBeenCalled();
    expect((await handler(request(own))).status).toBe(200);
  });

  it('updates another user without forwarding an email, password or arbitrary fields', async () => {
    const response = await userManagementHandler(services)(
      request({ ...input, action: 'update', id: staffId, role: 'accounts', active: false }),
    );
    expect(response.status).toBe(200);
    expect(services.update).toHaveBeenCalledWith(staffId, {
      full_name: input.full_name,
      phone: null,
      role: 'accounts',
      active: false,
    });
  });

  it('reports missing users and database last-admin protection', async () => {
    const handler = userManagementHandler(services);
    expect(
      (
        await handler(
          request({ ...input, action: 'update', id: '00000000-0000-0000-0000-000000000099' }),
        )
      ).status,
    ).toBe(404);
    vi.mocked(services.update).mockRejectedValueOnce(
      new UserManagementError(409, 'At least one active administrator is required'),
    );
    const response = await handler(request({ ...input, action: 'update', id: staffId }));
    expect(response.status).toBe(409);
    expect(await response.text()).toContain('At least one active administrator');
  });

  it('returns duplicate-email conflicts and sanitises unexpected backend errors', async () => {
    const handler = userManagementHandler(services);
    vi.mocked(services.create).mockRejectedValueOnce(
      new UserManagementError(409, 'A user with this email already exists.'),
    );
    expect((await handler(request(input))).status).toBe(409);
    vi.mocked(services.create).mockRejectedValueOnce(
      new Error('secret backend connection details'),
    );
    const response = await handler(request(input));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret');
  });

  it('resets another user’s password without ever returning it', async () => {
    const handler = userManagementHandler(services);
    const response = await handler(
      request({
        action: 'reset_password',
        id: staffId,
        password: 'ReplacementPass9!',
        role: 'admin',
      }),
    );
    expect(response.status).toBe(200);
    expect(services.resetPassword).toHaveBeenCalledWith(staffId, 'ReplacementPass9!');
    expect(services.update).not.toHaveBeenCalled();
    const text = await response.text();
    expect(JSON.parse(text).user.id).toBe(staffId);
    expect(text).not.toContain('ReplacementPass9!');
  });

  it('refuses unsafe password resets', async () => {
    const handler = userManagementHandler(services);
    const reset = (body: object) => handler(request({ action: 'reset_password', ...body }));
    // Your own password must go through the current-password check instead.
    expect((await reset({ id: adminId, password: 'ReplacementPass9!' })).status).toBe(409);
    expect((await reset({ id: staffId, password: 'too-short' })).status).toBe(400);
    expect((await reset({ id: staffId, password: 'x'.repeat(129) })).status).toBe(400);
    expect((await reset({ id: staffId })).status).toBe(400);
    expect((await reset({ id: 'not-a-user', password: 'ReplacementPass9!' })).status).toBe(400);
    expect(
      (await reset({ id: '00000000-0000-0000-0000-000000000009', password: 'ReplacementPass9!' }))
        .status,
    ).toBe(404);
    expect(services.resetPassword).not.toHaveBeenCalled();
  });

  it('lets only active administrators reset passwords', async () => {
    const handler = userManagementHandler(services);
    vi.mocked(services.authenticate).mockResolvedValue({ id: staffId });
    const response = await handler(
      request({ action: 'reset_password', id: adminId, password: 'ReplacementPass9!' }),
    );
    expect(response.status).toBe(403);
    expect(services.resetPassword).not.toHaveBeenCalled();
  });

  it('enforces origin, method, request size and JSON boundaries', async () => {
    const handler = userManagementHandler(services);
    expect((await handler(request(input, 'valid', 'https://untrusted.example'))).status).toBe(403);
    expect(
      (await handler(new Request('https://example.com/manage-users', { method: 'GET' }))).status,
    ).toBe(405);
    expect((await handler(request({ ...input, padding: 'x'.repeat(9000) }))).status).toBe(413);
    const malformed = new Request('https://example.com/manage-users', {
      method: 'POST',
      headers: { authorization: 'Bearer valid' },
      body: '{invalid',
    });
    expect((await handler(malformed)).status).toBe(400);
    const preflight = await handler(
      new Request('https://example.com/manage-users', {
        method: 'OPTIONS',
        headers: { origin: 'https://erp.chemmanoormetals.com' },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(
      'https://erp.chemmanoormetals.com',
    );
    expect(services.create).not.toHaveBeenCalled();
  });
});

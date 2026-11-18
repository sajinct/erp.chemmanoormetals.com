# Chemmanoor Metals ERP

Phase 1: leads, customers, measurements with revisions, quotations and payment tracking.
Angular front end; hosted Supabase (Postgres, Auth, Storage) back end. No local database is needed.

## Set up

1. Create a project at supabase.com.
2. Apply the database schema, either way:
   - CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push --remote`
   - or apply all files in `supabase/migrations/` through the dashboard's SQL editor, in filename order.
3. Put the project URL and anon (publishable) key in `src/environments/environment.ts`.
4. `npm install`, then `npm start` and open http://localhost:4200.

The first person to use "Request access" on the sign-in page becomes the admin.
Everyone after that is inactive until an admin activates them in **Users & roles** and picks a role.
If the project has "Confirm email" switched on (Authentication > Sign In / Providers), new
users must click the emailed link before they can sign in.

## User management

Admins open **Users & roles** in the sidebar (or **Manage users** in Settings). They can create
staff accounts, edit names and phone numbers, assign any of the five roles, and activate/deactivate
access. The page includes search, role/status filters, pagination and a role guide. Accounts are
deactivated rather than deleted so project history remains intact. Email addresses are fixed after creation.

New admin-created accounts use an initial password of at least 12 characters and are email-confirmed
by the admin API. The form can generate a secure password; share it with the staff member separately.
Creating an account does not send an invitation email and does not replace the admin's own session.

Deploy the backend before using account creation:

```bash
npx supabase db push --remote
npx supabase functions deploy manage-users --use-api --yes
```

The Edge Function validates the caller's bearer token with Supabase Auth, then requires a current,
active admin profile. Its service-role key is supplied by the Supabase runtime and never shipped
to the browser. `verify_jwt = false` disables only the gateway's legacy JWT check; token validation
is performed inside the function, including support for asymmetric signing keys.
The function accepts the production app origin and localhost development origins. Set the function's
`APP_ORIGIN` environment variable if the app moves to another domain.

User creation and its initial role/status are one Auth/database transaction using trusted app metadata.
Public sign-up metadata cannot assign privileges. The API and database protect an admin's own access;
the database also prevents removing the last active admin. Deactivation takes effect immediately in
database access policies, even for existing sessions; staff can refresh to update their visible menus.

## Roles

| Role        | Can do                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Admin       | Everything, including settings and users                                     |
| Approver    | Sales work, plus approving a measurement revision as final and editing rates |
| Sales       | Leads, projects, measurements, quotes                                        |
| Measurement | Leads, projects, measurements                                                |
| Accounts    | Record payments                                                              |

## Checks

```bash
npm test -- --watch=false     # unit tests: quote maths, message links, Excel validation, PDF
npm run test:user-access     # disposable in-memory PostgreSQL tests; never uses the live database
npm run build
npm run check:pwa             # verify the built PWA, release version, icons and cached asset hashes
```

`supabase/tests/` holds two database checks that need a throwaway local stack
(`npx supabase start`, Docker). Do not point them at the live project: `e2e.mjs` creates
test users and records.

## Deploy

The app version is kept in `package.json` and shown in the workspace,
sign-in page and app menu. Use `npm version patch --no-git-tag-version` (or `minor` / `major`)
for a release, then commit and push the updated package files with the changes.
`npm run build` stamps the generated service-worker manifest with the same version and CI commit.

Users can choose Device theme, Light or Dark from the appearance button. Their choice is saved
on that device. The install menu offers the browser's native PWA prompt when supported, with
manual instructions for Safari and other browsers. Installation needs HTTPS or localhost.

Production builds include Angular's service worker. It checks for a new release after startup,
when returning to the app or reconnecting, and hourly while open. Users can also choose
**Check for updates**. A downloaded release offers **Update now** or **Later**; save any edits
before updating. Only static app assets are cached; Supabase records, authentication requests
and customer documents are not added to service-worker caches. ERP reads and writes need a connection.

For local PWA verification, build with `npm run build`, then serve `dist/chemmanoor-erp/browser`
over localhost with a static server. `npm start` intentionally disables the service worker.

Every push to `main` runs the tests, builds, and publishes to GitHub Pages at
https://erp.chemmanoormetals.com (see `.github/workflows/deploy.yml`). The domain needs a
DNS record: `CNAME erp -> sajinct.github.io`.

Database changes are separate: add a file to `supabase/migrations/` and run
`npx supabase db push --remote`.

## Layout

- `supabase/migrations/` schema, business rules and access policies, seed data
- `supabase/functions/manage-users/` authenticated admin-only account creation and user updates
- `src/app/core/` Supabase client, sign-in and roles, data types
- `src/app/shared/` message links, quote maths, Excel, PDF, file attachments
- `src/app/features/` one folder per screen

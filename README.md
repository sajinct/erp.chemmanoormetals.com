# Chemmanoor Metals ERP

Phase 1: leads, customers, measurements with revisions, quotations and payment tracking.
Angular front end; hosted Supabase (Postgres, Auth, Storage) back end. No local database is needed.

## Set up

1. Create a project at supabase.com.
2. Apply the database schema, either way:
   - CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`
   - or paste the three files in `supabase/migrations/` into the dashboard's SQL editor, in order.
3. Put the project URL and anon (publishable) key in `src/environments/environment.ts`.
4. `npm install`, then `npm start` and open http://localhost:4200.

The first person to use "Request access" on the sign-in page becomes the admin.
Everyone after that is inactive until an admin activates them in Settings and picks a role.
If the project has "Confirm email" switched on (Authentication > Sign In / Providers), new
users must click the emailed link before they can sign in.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything, including settings and users |
| Approver | Sales work, plus approving a measurement revision as final and editing rates |
| Sales | Leads, projects, measurements, quotes |
| Measurement | Leads, projects, measurements |
| Accounts | Record payments |

## Checks

```bash
npm test -- --watch=false     # unit tests: quote maths, message links, Excel validation, PDF
npm run build
```

`supabase/tests/` holds two database checks that need a throwaway local stack
(`npx supabase start`, Docker). Do not point them at the live project: `e2e.mjs` creates
test users and records.

## Deploy

Every push to `main` runs the tests, builds, and publishes to GitHub Pages at
https://erp.chemmanoormetals.com (see `.github/workflows/deploy.yml`). The domain needs a
DNS record: `CNAME erp -> sajinct.github.io`.

Database changes are separate: add a file to `supabase/migrations/` and run
`npx supabase db push`.

## Layout

- `supabase/migrations/` schema, business rules and access policies, seed data
- `src/app/core/` Supabase client, sign-in and roles, data types
- `src/app/shared/` message links, quote maths, Excel, PDF, file attachments
- `src/app/features/` one folder per screen

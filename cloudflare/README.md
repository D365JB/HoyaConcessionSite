# Hoyas Concession — Cloudflare Workers + Hyperdrive Package

This package deploys the React volunteer-signup application, its Express/tRPC API, password-based admin sessions, and scheduled morning reminders as one Cloudflare Worker. It preserves the existing MySQL schema and volunteer records by connecting through **Cloudflare Hyperdrive** rather than migrating to a different database.

> **Important:** Do not point the production Worker at the current Manus-managed database. Create or select a MySQL database that you control, migrate the schema and data to it, then create Hyperdrive against that database. Cloudflare recommends Hyperdrive for MySQL connections from Workers because direct secure database connections rely on unsupported Node APIs. [1]

| Component | Cloudflare service | Configuration |
|---|---|---|
| React public site and admin UI | Worker static assets | `assets` section in `wrangler.jsonc` |
| Express + tRPC API | Workers with Node compatibility | `server/cloudflareWorker.ts` |
| Existing MySQL data model | Hyperdrive + external MySQL | `HYPERDRIVE` binding |
| Confirmation and admin email | Cloudflare Email Service | `EMAIL` binding and `EMAIL_FROM` secret |
| 8:30 AM ET volunteer reminders | Workers Cron Trigger | `30 12,13 * * *` plus an Eastern-time guard |
| Password-admin sessions | Worker secrets + signed cookies | `JWT_SECRET` secret |

## 1. Create or select a MySQL database

Export the current schema and data, then import it into a MySQL database you administer. Confirm that the target supports public or Cloudflare-reachable connectivity. Keep the database credentials outside this repository.

## 2. Create Hyperdrive

From the project root, create a Hyperdrive configuration using the connection string for the target database:

```bash
npx wrangler hyperdrive create hoyas-concession-mysql --connection-string="mysql://USER:PASSWORD@HOST:3306/DATABASE"
```

Copy the returned ID into `cloudflare/wrangler.jsonc` in place of `REPLACE_WITH_YOUR_HYPERDRIVE_ID`. For local testing, replace `REPLACE_WITH_A_LOCAL_MYSQL_CONNECTION_STRING` with a safe development connection string. Hyperdrive maintains the underlying database connection pool, so the Worker creates a compatible `mysql2` connection for each request. [1]

## 3. Enable Cloudflare Email Service (outbound email)

The Worker sends volunteer confirmations, admin notifications, and morning reminders through the `EMAIL` binding (`send_email` in `wrangler.jsonc`). The code already targets Cloudflare Email Service's current `env.EMAIL.send({ to, from, subject, html })` API, so no code changes are needed — only account setup:

1. **Use Cloudflare DNS for your sending domain.** Email Service requires the domain to be on Cloudflare DNS. If your Hoya domain is not yet on Cloudflare, add the site and move its nameservers first.
2. **Onboard the domain for Email Sending.** In the dashboard: **Compute → Email Service → Email Sending → Onboard Domain**, choose your domain, and accept the DNS records Cloudflare adds under `cf-bounce` (bounce MX, SPF, DKIM, and a `_dmarc` DMARC record). On Cloudflare DNS this usually propagates in 5–15 minutes.
3. **Enable the Workers Paid plan.** Sending to arbitrary recipients (volunteers) requires Workers Paid. It includes 3,000 outbound emails per month, then $0.35 per 1,000 — comfortably above this program's volume. On the free plan you can only send to verified destination addresses in your own account.
4. **Set the sender secrets** (see step 4 below): `EMAIL_FROM` must be an address at the onboarded domain (for example `Hoyas Concession <noreply@hoyaconcessions.com>`), and `ADMIN_EMAIL` is where new-signup notifications are sent.

Signup email is dispatched non-blocking, so an incomplete email setup will not break volunteer registration — sends simply no-op and log a warning until the domain and plan are ready. [2]

## 4. Set Worker secrets

Copy the example file only for local development:

```bash
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
```

For production, set every secret in the Cloudflare dashboard under **Workers & Pages → hoyas-concession → Settings → Variables and Secrets**, or use Wrangler:

```bash
npx wrangler secret put JWT_SECRET --config cloudflare/wrangler.jsonc
npx wrangler secret put BOOTSTRAP_ADMIN_EMAIL --config cloudflare/wrangler.jsonc
npx wrangler secret put BOOTSTRAP_ADMIN_PASSWORD --config cloudflare/wrangler.jsonc
npx wrangler secret put EMAIL_FROM --config cloudflare/wrangler.jsonc
npx wrangler secret put ADMIN_EMAIL --config cloudflare/wrangler.jsonc
```

The bootstrap email and password are used only to create the first local admin account. After confirming that account works, retain the values securely or remove them from the Worker; subsequent admin creation happens inside **Admin Access**.

## 5. Build and validate

The Cloudflare build omits Manus-specific development runtime tooling while producing the same React static assets:

```bash
pnpm run build:cloudflare
npx wrangler deploy --dry-run --config cloudflare/wrangler.jsonc
```

Run a local Worker test with the target MySQL development database configured:

```bash
npx wrangler dev --config cloudflare/wrangler.jsonc
```

Confirm `/api/health`, one public volunteer signup, one admin login, an Excel export, and an email notification before production cutover.

## 6. Deploy and connect the Hoya domain

Deploy the built worker:

```bash
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

In Cloudflare Workers, attach the Hoya subdomain route after the deployment succeeds. The static assets and API ship together; only `/api/*` requests run Worker code before static-asset delivery. [3]

## Operational note: reminders

Cloudflare Cron Triggers execute in UTC. The package schedules both potential UTC hours for 8:30 AM Eastern and uses a runtime `America/New_York` check so that messages send once at the correct local time across daylight-saving changes. Allow up to 15 minutes for Cron Trigger configuration changes to propagate. [4]

## References

[1] [Cloudflare Workers — Connect to a MySQL database](https://developers.cloudflare.com/workers/tutorials/mysql/)

[2] [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)

[3] [Cloudflare Workers — Static Assets](https://developers.cloudflare.com/workers/static-assets/)

[4] [Cloudflare Workers — Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

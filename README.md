# TGM Check-in

A visitor-management portal for companies. Visitors scan one reusable reception QR code, enter their contact details, choose the employee they are visiting, and give a reason for their visit. Their arrival waits for an administrator to approve it; approval checks them in and emails the selected host.

## Get started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase credentials, the portal opens in **demo mode**. Sample visits and reception settings are saved in this browser. Try the visitor flow from **Show QR code**, or add a visitor from the reception dashboard.

## Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to your project URL and publishable key (the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name still works).
3. Apply every migration in `supabase/migrations/` using the Supabase SQL editor or your migration workflow, in filename order.
4. Enable email/password authentication in Supabase Auth. Company administrators create an account or sign in from the portal.
5. Set `SUPABASE_SERVICE_ROLE_KEY` in the server environment for reception invitations and private host-email lookup. This secret must never use the `NEXT_PUBLIC_` prefix or be exposed to the browser.
6. Create a Resend account, verify a sender domain/address, and set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in the server environment. Do not prefix these values with `NEXT_PUBLIC_`.
7. Set `NEXT_PUBLIC_SITE_URL` to `https://reception.tgmeducation.net` so downloaded reception QR codes use the public check-in domain. For local testing, override it with your local address, such as `http://localhost:3000`.
8. In Supabase Auth → URL Configuration, allow the dashboard origin used for signup to redirect back after email confirmation (for example, `https://your-dashboard-domain/**` and `http://localhost:3000/**` for local testing).
9. Restart the development server after changing environment variables.

Visitor records are protected by row-level security and belong to the company administrator. A company-specific reception QR token routes visitors to a public check-in form. Narrow `SECURITY DEFINER` functions validate that QR token and record the visit without exposing private visitor records. Keep the anon key public and never put a Supabase service-role key in a browser environment variable.

Company signup collects a full name in Supabase Auth user metadata for display in the reception profile. With email confirmations enabled, signup displays a check-your-email screen; confirming the link returns to the sign-in form.

## Cloudflare Workers deployment

This app uses OpenNext to run on Cloudflare Workers. The Worker is named `tgm-check-in`, and its `WORKER_SELF_REFERENCE` service binding targets that same Worker. The reception QR domain `reception.tgmeducation.net` is configured as the Worker custom domain.

1. Run `npx wrangler login` to authenticate with Cloudflare.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the environment used for the build. For local deployment, these can come from `.env.local`; configure them in your CI build environment for automated deployments.
3. Add the server-only runtime secrets to the Worker with `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `npx wrangler secret put RESEND_API_KEY`, and `npx wrangler secret put RESEND_FROM_EMAIL`.
4. For local Worker previews, put those runtime values in the ignored `.dev.vars` file; deployed Worker secrets are not available to local previews.
5. Run `npm run preview` to test in the Workers runtime, then `npm run deploy` to deploy the Worker.

If configuring build and deploy commands separately in Cloudflare, use `npm run build:cloudflare` (equivalent to `npx opennextjs-cloudflare build`) for the build command and `npm run deploy` (equivalent to `npx opennextjs-cloudflare deploy`) for the deploy command. Do not use `npm run build` as the Cloudflare build command; it only runs the underlying Next.js build and does not generate the Worker bundle.

Add employee names and work email addresses under **Settings → Employee host directory**. The public QR form exposes employee names only, never their email addresses. An administrator approves arrivals from the visitor log; the server-side approval endpoint then emails the selected employee through Resend. If email delivery fails after approval, the administrator can retry it from the visitor row. Demo mode supports the approval flow locally but never sends real email.

Visitors can also select **Check out** on the reception QR page. The portal emails a one-time code to the address on their active visit; the code expires after 10 minutes, allows up to 6 attempts, and checkout codes are limited to 3 requests per visitor every 10 minutes. Apply `20261015120000_add_self_checkout_verification.sql` and configure Supabase plus Resend for this feature. It is intentionally unavailable in browser-only demo mode.

Company administrators can invite reception staff under **Settings → Reception team access**. Invited staff receive a Supabase Auth email to set up their password and sign in with their own account. They can view the visitor log, approve arrivals, and check visitors out; only the workspace owner can change company settings, employee hosts, or team access. Supabase row-level security enforces these workspace and role boundaries.

## Features

- Daily reception dashboard showing today's visitors, visitors currently on site, and completed visits.
- Reusable company reception QR code and mobile visitor request form.
- Visitor first and last name, optional middle name, phone number, email, company, employee host, and visit purpose.
- Admin approval queue, host email notifications, visitor log, status filters, and manual check-in/check-out.
- Visitor self-checkout from the reception QR page using an emailed one-time verification code.
- Employee directory with host names and work email addresses.
- Daily, weekly (Sunday–Saturday), and monthly reports calculated from stored visitor records, filterable by visit purpose.
- Today's arrival chart, attendance status, and visits-by-host report.
- Supabase Auth, owner-scoped Postgres storage, and Realtime dashboard updates.
- Browser-local demo mode when Supabase is not configured.

# Email setup (Brevo + Supabase)

TalaArawan uses two email paths:

| Email | Sent by | Configuration |
| --- | --- | --- |
| **Confirm signup** | Supabase Auth via **Brevo SMTP** | Supabase Email Template + SMTP key |
| **Password reset** | Supabase Edge Function via **Brevo API** | `send-email` function + API key |
| **Test email** | Supabase Edge Function via **Brevo API** | `send-email` function + API key |

There is **no welcome email** — the confirmation email is the only message sent at sign-up.

## 1. Verify your Brevo sender

In Brevo, go to **Senders & Domains → Domains** and verify the domain or exact sender address you will use. Unverified senders are rejected.

## 2. Confirmation email (Supabase → Brevo SMTP)

1. **Supabase Dashboard → Authentication → Providers → Email**: turn **Confirm email ON**. New accounts are not active until the link is clicked.
2. **Supabase Dashboard → Authentication → SMTP**: enable Custom SMTP:
   - Host: `smtp-relay.brevo.com`
   - Port: `587` (STARTTLS) or `465` (SSL/TLS)
   - Username: the SMTP login shown in Brevo (usually something like `1234567@smtp-brevo.com`), **not** your Brevo account email
   - Password: a Brevo **SMTP key** (Brevo → SMTP & API → SMTP) — this is *not* the API key
   - Sender email: the verified Brevo sender (this becomes the `From` address for all Auth emails); Sender name: `TalaArawan`
3. **Supabase Dashboard → Authentication → Email Templates → Confirm signup**: paste the custom HTML from [`templates/confirm-signup.html`](templates/confirm-signup.html) into the body, and use this subject:

   ```text
   Verify your TalaArawan email address
   ```

   The template is a hand-built, table-based HTML email (responsive, inline styles) with the TalaArawan brand, a single verification button, a fallback link, and a three-step "what happens next" section. It uses `{{ .ConfirmationURL }}` and `{{ .Email }}`, which Supabase fills in when it renders the email; Supabase then delivers it through your Brevo SMTP sender.
4. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**: add the page that redeems the token:

   ```text
   http://localhost:5173/auth
   https://your-production-domain.com/auth
   ```

   Use your actual dev port if it differs.

When the user clicks the link, Supabase redirects to `/auth` with the tokens in the URL hash. `AuthPage.tsx` redeems them, shows an **Email confirmed** screen, and the user continues to the dashboard. On first login, the walkthrough runs first, followed by the one-screen quick setup.

## 3. Brevo API secrets for the Edge Function

The `send-email` function handles password resets and test emails. Its API key stays server-side.

```bash
# one-time, from the project root
supabase login
supabase link --project-ref <your-project-ref>

# Brevo credentials (never prefix with VITE_)
supabase secrets set BREVO_API_KEY=your-brevo-api-key
supabase secrets set BREVO_SENDER_EMAIL=no-reply@yourdomain.com
supabase secrets set BREVO_SENDER_NAME="TalaArawan"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. The function uses the service-role key only to generate the password-recovery link.

## 4. Deploy the function

```bash
supabase functions deploy send-email
```

`supabase/config.toml` sets `verify_jwt = false` so a signed-out user can request a reset link. The function still requires a session for the `test` action, so it is not an open mail relay.

## 5. Test it

1. Sign up a new account → the confirmation email arrives from your Brevo sender with the branded template.
2. Click the confirmation link → `/auth` shows **Email confirmed**; Continue takes you to the dashboard, where the tour and quick setup run once.
3. Open **Settings → Account → Send test email** → the test email arrives through the Edge Function.
4. Click **Forgot?** → the reset link opens `/auth` and shows the new-password form.

## Local development

Create an untracked file `supabase/functions/.env.local`:

```env
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=TalaArawan
```

Then serve the function locally:

```bash
supabase functions serve send-email --env-file supabase/functions/.env.local
```

The client calls it through `supabase.functions.invoke('send-email', ...)`, so it works against the remote or local function depending on your Supabase client configuration.

## Troubleshooting: 429 on sign-up

A `429` on `POST /auth/v1/signup` is **Supabase Auth's rate limit**, not Brevo. Free projects are strict, and signing up many test accounts in a short time will hit it. The app shows a cooldown message and blocks double submissions. Confirmation mail going through Brevo SMTP avoids Supabase's own mail queue, but the signup endpoint itself is still rate-limited. The window resets on its own — waiting a few minutes is usually enough. For higher limits, contact Supabase support.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, x-client-info, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BRAND = 'TalaArawan'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface LayoutOptions {
  title: string
  preheader: string
  eyebrow: string
  heading: string
  body: string
  accent: string
  note?: string
  button?: { text: string; url: string }
}

function layout({
  title,
  preheader,
  eyebrow,
  heading,
  body,
  accent,
  note,
  button,
}: LayoutOptions): string {
  const safeButton = button
    ? `<tr><td align="center" style="padding:30px 32px 4px;">
        <a href="${escapeHtml(button.url)}" class="email-button" style="display:inline-block;background:${accent};color:#fffdf8;padding:14px 26px;border-radius:10px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;">${escapeHtml(
          button.text,
        )}</a>
      </td></tr>`
    : ''

  const safeFallback = button
    ? `<tr><td style="padding:14px 32px 0;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8a806d;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(
          button.url,
        )}" style="color:${accent};">${escapeHtml(button.url)}</a></p>
      </td></tr>`
    : ''

  const safeNote = note
    ? `<tr><td class="email-pad" style="padding:22px 32px 0;">
        <div style="padding:14px 16px;background:#f6f1e6;border-left:3px solid ${accent};border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#605a4c;">${note}</div>
      </td></tr>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-wrapper { padding: 16px 10px !important; }
        .email-card { border-radius: 14px !important; }
        .email-pad { padding-left: 22px !important; padding-right: 22px !important; }
        .email-heading { font-size: 23px !important; line-height: 1.25 !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f1e9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      preheader,
    )}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-wrapper" style="background:#f4f1e9;padding:36px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:560px;background:#fffdf8;border:1px solid #e7e0d2;border-radius:18px;box-shadow:0 18px 50px -30px rgba(34,53,42,0.35);">
          <tr>
            <td class="email-pad" style="padding:30px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="38" style="width:38px;height:38px;background:${accent};border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:700;color:#fffdf8;line-height:38px;">T</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:700;color:#22352a;">${BRAND}</span>
                    <span style="display:block;margin-top:3px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#8a806d;">Philippine field notes</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td class="email-pad" style="padding:22px 32px 0;"><div style="height:3px;width:42px;background:${accent};border-radius:3px;"></div></td></tr>
          <tr>
            <td class="email-pad" style="padding:22px 32px 0;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${accent};">${escapeHtml(
                eyebrow,
              )}</p>
              <h1 class="email-heading" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.22;font-weight:700;color:#1f2e24;">${escapeHtml(
                heading,
              )}</h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#4a4539;">${body}</div>
            </td>
          </tr>
          ${safeNote}
          ${safeButton}
          ${safeFallback}
          <tr>
            <td class="email-pad" style="padding:26px 32px 30px;border-top:1px solid #eae3d5;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8a806d;">${escapeHtml(
                title,
              )} · Your journal is private by default.</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8a806d;">You received this because you have a ${BRAND} account.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = (await request.json()) as {
      action?: string
      email?: string
      fullName?: string
      redirectTo?: string
    }
    const email = payload.email?.trim() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('A valid email address is required.')
    }

    const apiKey = Deno.env.get('BREVO_API_KEY')
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL')
    const senderName = Deno.env.get('BREVO_SENDER_NAME') || BRAND
    if (!apiKey || !senderEmail) {
      throw new Error('Brevo is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL as Supabase secrets.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase admin credentials are unavailable in this Edge Function.')
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Password reset can be requested while signed out. All other actions require a session
    // so anonymous callers cannot use the function as a free mail relay.
    if (payload.action !== 'password_reset') {
      const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      if (!token) throw new Error('You must be signed in to send this email.')
      const {
        data: { user },
        error: authError,
      } = await admin.auth.getUser(token)
      if (authError || !user) throw new Error('Your session is invalid. Please sign in again.')
    }

    const name = (payload.fullName || 'there').trim()
    const safeName = escapeHtml(name)
    let subject: string
    let htmlContent: string
    let textContent: string

    if (payload.action === 'password_reset') {
      const redirectTo =
        payload.redirectTo || Deno.env.get('SITE_URL') || request.headers.get('origin') || ''
      if (!redirectTo) throw new Error('A password-reset redirect URL is required.')

      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      if (error) throw error
      const link = data.properties.action_link
      if (!link) throw new Error('Could not create a password-reset link.')

      subject = `Reset your ${BRAND} password`
      htmlContent = layout({
        title: 'Password reset',
        preheader: 'Use this link to choose a new password for your account.',
        eyebrow: 'Account security',
        heading: 'Reset your password',
        body: `<p style="margin:0;">Hi ${safeName}, we received a request to reset your ${BRAND} password. Use the button below to choose a new one.</p>`,
        accent: '#8a5a2b',
        note: `<strong style="color:#3a3529;">Quick note:</strong> This link expires soon and can only be used once. If you did not request this, you can safely ignore this email.`,
        button: { text: 'Choose a new password', url: link },
      })
      textContent = `Hi ${name}, reset your ${BRAND} password with this link: ${link}\nThis link expires soon and can only be used once.`
    } else if (payload.action === 'test') {
      subject = `${BRAND} test email`
      htmlContent = layout({
        title: 'Test email',
        preheader: 'This confirms that email delivery is working.',
        eyebrow: 'Delivery check',
        heading: 'Email delivery works',
        body: `<p style="margin:0 0 14px;">Hi ${safeName}, this message confirms that ${BRAND} can reach your inbox through Brevo.</p><p style="margin:0;">If you can see this, your sender and delivery settings are working.</p>`,
        accent: '#3d6b8a',
      })
      textContent = `Hi ${name}, this is a test email from ${BRAND}. If you can read this, email delivery works.`
    } else {
      throw new Error('Unknown email action.')
    }

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: payload.fullName?.trim() || undefined }],
        subject,
        htmlContent,
        textContent,
      }),
    })

    const brevoBody = (await brevoResponse.json().catch(() => ({}))) as {
      messageId?: string
      message?: string
    }
    if (!brevoResponse.ok) {
      throw new Error(brevoBody.message || `Brevo returned status ${brevoResponse.status}.`)
    }

    return new Response(
      JSON.stringify({ ok: true, messageId: brevoBody.messageId ?? null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send email.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

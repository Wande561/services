# Email deliverability

## Why verification mail is in Spam

Production currently falls back to Gmail SMTP. That passes SPF, DKIM and DMARC because the message is authenticated as **Gmail**, not as ServiceConnect. A personal Gmail account sending automated account-verification links is a classic spam signal, even when authentication passes.

Use Resend with a domain you control, then configure:

- `RESEND_API_KEY` — API key from Resend.
- `MAIL_FROM` — `ServiceConnect <hello@yourdomain.com>` on the verified domain.
- `MAIL_REPLY_TO` — optional; replies should reach a monitored mailbox.
- `SUPPORT_EMAIL` — optional; shown in the email footer.

Resend is preferred automatically when the API key and sender are present.

## DNS to verify in Resend

Add every record Resend shows for the sending domain, usually:

- **SPF** (`TXT`) on the sending subdomain.
- **DKIM** (`TXT`/`CNAME`) for the Resend selector.
- **MX** records only if Resend asks for a return-path subdomain.
- **DMARC** (`TXT` at `_dmarc.yourdomain.com`), starting with `p=none`, then moving to `p=quarantine` once reports look clean.

Keep the sender domain aligned with the links in the email. A custom app domain is better than a `*.vercel.app` link; if you add one, set `FRONTEND_URL` to it and update the frontend rewrite/API origin together.

## Content rules we follow

- Plain-text and simple HTML versions.
- Clear sender name, `Reply-To`, and a footer with the business location and support address.
- `Auto-Submitted: auto-generated` and `X-Auto-Response-Suppress: All`.
- No link shorteners, no misleading subjects, no attachments in verification mail.
- One primary call to action per email.
- Verification links expire after one hour and are single-use.

## First-send checklist

1. Create a fresh Resend API key after the domain is verified.
2. Set `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO` and `SUPPORT_EMAIL` on the API project.
3. Remove `GMAIL_USER` and `GMAIL_APP_PASSWORD` from production so the fallback cannot take over.
4. Redeploy the API and send one verification email to an account you own.
5. In Gmail, open the message → **Show original** and confirm `SPF`, `DKIM` and `DMARC` pass for **your** domain, not `gmail.com`.
6. If it lands in Spam, mark **Not spam**, add the sender to contacts, and reply once; this trains the mailbox.
7. Register the domain in Google Postmaster Tools and check reputation/blocklists.
8. Send low volume first and avoid blasting a new domain.

## If it still lands in Spam

- Check the domain age and reputation; new domains need warm-up.
- Confirm DMARC alignment and that the visible `From` matches the authenticated domain.
- Remove the Gmail fallback from production.
- Check the sending IP/domain against major blocklists.
- Consider a dedicated IP only once volume justifies it.
- Do not ask recipients to whitelist a Gmail address; fix the domain instead.

## Welcome email

A welcome email is sent after a password account completes email verification and after the first Google sign-in creates an account. A delivery failure does not roll back account creation. The same signed-in user is not sent the welcome message again.

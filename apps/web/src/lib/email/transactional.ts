import { Resend } from 'resend'
import { consoleLogger as logger } from '@/lib/console-logger'

interface PropertyInviteEmailParams {
  to: string
  inviterEmail: string
  propertyName: string
  role: string
  acceptUrl: string
}

export async function sendPropertyInviteEmail(params: PropertyInviteEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping invite email')
    return
  }

  const resend = new Resend(apiKey)
  const roleLabel = params.role === 'editor' ? 'editor (can make changes)' : 'viewer (read-only)'

  const text = [
    `${params.inviterEmail} has invited you to access "${params.propertyName}" on Hausdog as a ${params.role}.`,
    '',
    `Accept or decline the invitation by visiting:`,
    params.acceptUrl,
    '',
    'If you do not have a Hausdog account, you will be prompted to create one.',
    '',
    "If you didn't expect this invitation, you can safely ignore this email.",
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f9f9f9;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111">You've been invited to Hausdog</h1>
    <p style="margin:0 0 20px;color:#374151">
      <strong>${params.inviterEmail}</strong> has invited you to access
      <strong>"${params.propertyName}"</strong> as a <strong>${roleLabel}</strong>.
    </p>
    <a href="${params.acceptUrl}"
       style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px">
      View invitation
    </a>
    <p style="margin:24px 0 0;color:#6b7280;font-size:13px">
      If you don't have a Hausdog account, you'll be prompted to create one after clicking the link.
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`.trim()

  const { error } = await resend.emails.send({
    from: 'Hausdog <noreply@hausdog.app>',
    to: params.to,
    subject: `${params.inviterEmail} invited you to "${params.propertyName}" on Hausdog`,
    text,
    html,
  })

  if (error) {
    logger.warn('Failed to send property invite email', { to: params.to, error: error.message })
  }
}

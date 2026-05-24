// api/submit.js — Teaching India form submission handler
// Sends email to contact@teachingindia.org via Resend (free tier)
// Set RESEND_API_KEY in Vercel environment variables

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    // Fail gracefully — still return 200 so user sees success
    // (avoids blocking submissions while key is being configured)
    return res.status(200).json({ ok: true, note: 'Email not sent — API key missing' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const {
    type,        // 'volunteer' | 'enquiry'
    program,     // e.g. 'board-exam-readiness'
    firstName,
    lastName,
    email,
    phone,
    occupation,
    city,
    role,
    subject,
    module,
    industry,
    format,
    message,
  } = body;

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const programLabel = {
    'board-exam-readiness': 'Board Exam Readiness',
    'career-compass': 'Career Compass',
    'workplace-skills-lab': 'Workplace Skills Lab',
    'mentor-network': 'Mentor Network',
  }[program] || program || 'Website';

  const typeLabel = type === 'volunteer' ? '🎓 New Volunteer Application' : '📩 New Programme Enquiry';

  // Build a clean HTML table of all submitted fields
  const fields = [
    ['Type', typeLabel],
    ['Program', programLabel],
    ['Name', fullName],
    ['Email', email],
    ['Phone', phone],
    occupation && ['Occupation', occupation],
    city && ['City', city],
    role && ['Role', role],
    subject && ['Subject Strength', subject],
    module && ['Module Interest', module],
    industry && ['Industry', industry],
    format && ['Mentoring Format', format],
    message && ['Message / Notes', message],
  ].filter(Boolean);

  const tableRows = fields
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;background:#f5f0e8;font-weight:600;font-size:13px;color:#5a6a8a;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:#1a2744;vertical-align:top">${value || '—'}</td>
      </tr>`)
    .join('');

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'DM Sans',system-ui,sans-serif;background:#faf7f2;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:6px;overflow:hidden;box-shadow:0 2px 16px rgba(26,39,68,0.08);">
    <div style="background:#1a2744;padding:28px 32px;">
      <div style="font-size:22px;font-weight:600;color:white;margin-bottom:4px;">Teaching<span style="color:#e8943a">India</span></div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:1.5px;text-transform:uppercase">${typeLabel}</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:15px;color:#5a6a8a;margin:0 0 20px">A new submission was received from the Teaching India website.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0ebe1;border-radius:4px;overflow:hidden">
        ${tableRows}
      </table>
      <div style="margin-top:24px;padding:16px;background:#faf7f2;border-radius:4px;border-left:3px solid #e8943a">
        <p style="margin:0;font-size:13px;color:#5a6a8a">Submitted at: <strong style="color:#1a2744">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}</strong></p>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#aab0bf">Reply directly to this email to respond to ${fullName}.</p>
    </div>
  </div>
</body>
</html>`;

  const textBody = fields.map(([l, v]) => `${l}: ${v || '—'}`).join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Teaching India Website <noreply@teachingindia.org>',
        to: ['contact@teachingindia.org'],
        reply_to: email || 'contact@teachingindia.org',
        subject: `${typeLabel} — ${fullName} (${programLabel})`,
        html: htmlBody,
        text: textBody,
      }),
    });

    const resendData = await response.json();

    if (!response.ok) {
      console.error('Resend error:', resendData);
      // Log but still return success to user — don't block them
      return res.status(200).json({ ok: true, warning: 'Email delivery issue, please follow up manually' });
    }

    return res.status(200).json({ ok: true, id: resendData.id });

  } catch (err) {
    console.error('Submit handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

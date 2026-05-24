// api/submit.js — Teaching India form submission handler
const https = require('https');

function httpsPost(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY env var is missing' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { type, program, firstName, lastName, email, phone,
    occupation, city, role, subject, format, industry, message } = body;

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const programLabel = {
    'board-exam-readiness': 'Board Exam Readiness',
    'career-compass': 'Career Compass',
    'workplace-skills-lab': 'Workplace Skills Lab',
    'mentor-network': 'Mentor Network',
  }[program] || program || 'Website';
  const typeLabel = type === 'volunteer' ? 'New Volunteer Application' : 'New Programme Enquiry';

  const fields = [
    ['Type', typeLabel], ['Program', programLabel], ['Name', fullName],
    ['Email', email], ['Phone', phone],
    occupation ? ['Occupation', occupation] : null,
    city ? ['City', city] : null,
    role ? ['Role', role] : null,
    subject ? ['Subject', subject] : null,
    industry ? ['Industry', industry] : null,
    format ? ['Format', format] : null,
    message ? ['Message', message] : null,
  ].filter(Boolean);

  const tableRows = fields.map(function(f) {
    return '<tr><td style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:600;color:#5a6a8a;white-space:nowrap;border-bottom:1px solid #ede8df">' + f[0] + '</td><td style="padding:8px 12px;font-size:14px;color:#1a2744;border-bottom:1px solid #ede8df">' + (f[1] || '-') + '</td></tr>';
  }).join('');

  const htmlBody = '<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#faf7f2;padding:32px"><div style="max-width:560px;margin:0 auto;background:white;border-radius:6px;overflow:hidden"><div style="background:#1a2744;padding:24px 28px"><div style="font-size:20px;font-weight:700;color:white">Teaching<span style="color:#e8943a">India</span></div><div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">' + typeLabel + '</div></div><div style="padding:24px 28px"><table style="width:100%;border-collapse:collapse;border:1px solid #ede8df">' + tableRows + '</table></div></div></body></html>';
  const textBody = fields.map(function(f) { return f[0] + ': ' + (f[1] || '-'); }).join('\n');

  const payload = JSON.stringify({
    from: 'Teaching India <noreply@teachingindia.org>',
    to: ['contact@teachingindia.org'],
    reply_to: email || undefined,
    subject: typeLabel + ' — ' + fullName + ' (' + programLabel + ')',
    html: htmlBody,
    text: textBody,
  });

  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  try {
    const result = await httpsPost(options, payload);
    if (result.status !== 200) {
      return res.status(200).json({ ok: false, resend_status: result.status, resend_error: result.data });
    }
    return res.status(200).json({ ok: true, id: result.data.id });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};

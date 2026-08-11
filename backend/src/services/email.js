// Envia email via API HTTP da Resend (não via SMTP direto) — o Render bloqueia as
// portas de SMTP de saída (465/587), então precisa ser algo que fale por HTTPS/443.
const RESEND_API_URL = 'https://api.resend.com/emails';

async function enviarCodigoRecuperacao(destinatario, codigo) {
  const remetente = process.env.EMAIL_FROM || 'Pelada OPED FC <onboarding@resend.dev>';

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remetente,
      to: [destinatario],
      subject: 'Código para redefinir sua senha — Pelada OPED FC',
      text: `Seu código de recuperação é: ${codigo}\n\nEle expira em 15 minutos. Se você não pediu essa recuperação, ignore este email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px">
          <div style="font:900 18px Arial,sans-serif;color:#0b1f3a">⚽ PELADA OPED FC</div>
          <p style="color:#333;font-size:15px">Seu código para redefinir a senha é:</p>
          <div style="font-size:36px;font-weight:800;letter-spacing:6px;color:#ff5a1f;margin:16px 0;text-align:center;background:#f4f7f0;padding:16px;border-radius:8px">${codigo}</div>
          <p style="color:#888;font-size:13px">Expira em 15 minutos. Se você não pediu essa recuperação, pode ignorar este email com segurança.</p>
        </div>
      `,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Resend respondeu ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

module.exports = { enviarCodigoRecuperacao };

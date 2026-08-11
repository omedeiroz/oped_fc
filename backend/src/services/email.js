const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function enviarCodigoRecuperacao(destinatario, codigo) {
  return getTransporter().sendMail({
    from: `"Pelada OPED FC" <${process.env.SMTP_USER}>`,
    to: destinatario,
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
  });
}

module.exports = { enviarCodigoRecuperacao };

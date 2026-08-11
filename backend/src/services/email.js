// Envia email via API HTTP da Brevo (não via SMTP direto) — o Render bloqueia as
// portas de SMTP de saída (465/587), então precisa ser algo que fale por HTTPS/443.
// Brevo só exige verificar o endereço remetente (não um domínio inteiro), então
// dá pra enviar pra qualquer destinatário sem precisar de um domínio próprio.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Template em tools/email-codigo-senha.html (mantenha os dois em sincronia se editar o visual).
function templateHtml(codigo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Código para redefinir sua senha — Pelada OPED FC</title>
<!--[if mso]>
<style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<style>
  @media only screen and (max-width:620px){
    .wrap{width:100% !important;}
    .px{padding-left:24px !important;padding-right:24px !important;}
    .code{font-size:38px !important;letter-spacing:8px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#0b1220;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Seu código de verificação chegou. Ele vale por 15 minutos — use e volte pra pelada.</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1220;">
<tr>
<td align="center" style="padding:32px 12px 40px 12px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;background-color:#16233a;border-radius:14px;border:1px solid #24365a;">

    <!-- Header -->
    <tr>
      <td class="px" style="padding:22px 40px;background-color:#101d31;border-radius:13px 13px 0 0;border-bottom:1px solid #24365a;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="6" style="width:6px;background-color:#f26522;font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding-left:12px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;mso-line-height-rule:exactly;font-weight:900;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;">Pelada OPED FC</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Título -->
    <tr>
      <td class="px" style="padding:38px 40px 0 40px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2px;color:#3ddc84;text-transform:uppercase;">Segurança da conta</div>
        <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
        <h1 style="margin:0;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:30px;line-height:34px;mso-line-height-rule:exactly;font-weight:900;letter-spacing:-0.5px;color:#ffffff;text-transform:uppercase;">Redefinir sua senha</h1>
        <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;mso-line-height-rule:exactly;color:#9fb0c9;">Recebemos um pedido para redefinir a senha da sua conta. Use o código abaixo para continuar.</p>
      </td>
    </tr>

    <!-- Código -->
    <tr>
      <td class="px" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f1b2d;border:1px solid #2a3f66;border-radius:12px;">
          <tr>
            <td align="center" style="padding:26px 16px 10px 16px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:13px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:2.5px;color:#7f92ad;text-transform:uppercase;">Seu código</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 16px 8px 16px;">
              <div class="code" style="font-family:'Courier New',Courier,monospace;font-size:46px;line-height:54px;mso-line-height-rule:exactly;font-weight:bold;letter-spacing:12px;color:#f26522;text-indent:12px;">${codigo}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 16px 24px 16px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;mso-line-height-rule:exactly;color:#7f92ad;">Expira em <span style="color:#e6edf7;font-weight:bold;">15 minutos</span></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Aviso -->
    <tr>
      <td class="px" style="padding:30px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="border-top:1px solid #24365a;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
        <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;mso-line-height-rule:exactly;color:#7f92ad;">Não pediu essa recuperação? Pode ignorar este email — sua senha continua a mesma. Nunca compartilhe este código com ninguém.</p>
      </td>
    </tr>

    <tr><td style="height:34px;line-height:34px;font-size:0;">&nbsp;</td></tr>
  </table>

  <!-- Rodapé -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrap" style="width:600px;max-width:600px;">
    <tr>
      <td align="center" class="px" style="padding:22px 40px 0 40px;">
        <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:11px;line-height:15px;mso-line-height-rule:exactly;font-weight:900;letter-spacing:2px;color:#5b6c85;text-transform:uppercase;">Pelada OPED FC</div>
        <div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;mso-line-height-rule:exactly;color:#5b6c85;">Email automático de segurança — não responda.<br><a href="https://peladaopedfc.com" style="color:#7f92ad;text-decoration:underline;">peladaopedfc.com</a></div>
      </td>
    </tr>
  </table>

</td>
</tr>
</table>
</body>
</html>
`;
}

async function enviarCodigoRecuperacao(destinatario, codigo) {
  const remetente = process.env.EMAIL_FROM || 'peladaoped@gmail.com';
  const remetenteNome = process.env.EMAIL_FROM_NOME || 'Pelada OPED FC';

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: remetente, name: remetenteNome },
      to: [{ email: destinatario }],
      subject: 'Código para redefinir sua senha — Pelada OPED FC',
      textContent: `Seu código de recuperação é: ${codigo}\n\nEle expira em 15 minutos. Se você não pediu essa recuperação, ignore este email.`,
      htmlContent: templateHtml(codigo),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Brevo respondeu ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

module.exports = { enviarCodigoRecuperacao };

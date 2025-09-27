const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
  MAIL_PROVIDER
} = process.env;

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT == 465, // true se usar 465
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

async function sendMail({ subject, text, html, to }) {
  if (!transporter) {
    return { sent: false, reason: 'SMTP não configurado' };
  }

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM || 'no-reply@bolaosca.com',
      to: to || MAIL_TO,
      subject,
      text,
      html
    });
    console.log('E-mail enviado:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('Erro ao enviar email:', err);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendMail };

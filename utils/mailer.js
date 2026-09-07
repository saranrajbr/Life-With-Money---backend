import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transporter;
}

const FROM = process.env.MAIL_FROM || '"Life With Money" <no-reply@localhost>';

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const mail = {
    from: FROM,
    to,
    subject: "Reset your Life With Money password",
    text:
      `You requested a password reset for your Life With Money account.\n\n` +
      `Click the link below to choose a new password (valid for 15 minutes):\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`
  };

  const t = getTransporter();
  if (!t) {
    // No SMTP configured — log the reset link so the flow can still be used
    // in development. Set SMTP_HOST/SMTP_USER/SMTP_PASS in production.
    console.log(`[mailer] Password reset for ${to}: ${resetUrl}`);
    return { ok: true, dev: true };
  }

  await t.sendMail(mail);
  return { ok: true };
}
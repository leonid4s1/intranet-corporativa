import nodemailer from "nodemailer";

const {
  SMTP_HOST = "smtp.gmail.com",
  SMTP_PORT = "587",
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_APP_NAME = "Intranet Odes",
  MAIL_REPLY_TO,
  MAIL_UNSUBSCRIBE_URL,
} = process.env;

/* ───────────────────────────────────────────────────────────── */

function createTransport() {
  const port = Number(SMTP_PORT || 587);

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: false, // 587 + STARTTLS
    requireTLS: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 45000,
  });
}

async function sendWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("email-timeout")), ms)
    ),
  ]);
}

/* ───────────────────────────────────────────────────────────── */
/* Helpers anti-spam */

function normalizeFrom(from) {
  if (from && from.includes("<") && from.includes(">")) return from;
  const addr = from || MAIL_FROM || SMTP_USER;
  return `${MAIL_APP_NAME} <${addr}>`;
}

function htmlToText(html = "") {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/* ───────────────────────────────────────────────────────────── */

export async function verifyEmailTransport() {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.error("[email] faltan SMTP_USER/SMTP_PASS");
      return false;
    }
    const tx = createTransport();
    await tx.verify();
    console.log(`[email] SMTP listo (${SMTP_HOST}:${SMTP_PORT})`);
    return true;
  } catch (e) {
    console.error("[email] SMTP verify falló:", e?.message || e);
    return false;
  }
}

/* ───────────────────────────────────────────────────────────── */

export async function sendMailSafe(mail, timeoutMs = 45000) {
  if (!SMTP_USER || !SMTP_PASS) {
    const msg = "SMTP_USER/SMTP_PASS no configurados";
    console.error("[email]", msg);
    return { ok: false, error: msg };
  }

  try {
    const tx = createTransport();

    const from = normalizeFrom(mail.from);
    const text = mail.text || (mail.html ? htmlToText(mail.html) : undefined);

    const headers = {
      ...(mail.headers || {}),
      "X-App": MAIL_APP_NAME,
      "X-Entity-Ref-ID": `${Date.now()}`,
      "Auto-Submitted": "auto-generated",
      "Precedence": "bulk",
    };

    if (MAIL_UNSUBSCRIBE_URL) {
      headers["List-Unsubscribe"] = `<${MAIL_UNSUBSCRIBE_URL}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const payload = {
      ...mail,
      from,
      replyTo: mail.replyTo || MAIL_REPLY_TO || MAIL_FROM || SMTP_USER,
      text,
      headers,
    };

    const info = await sendWithTimeout(tx.sendMail(payload), timeoutMs);
    console.log("[email] enviado:", info?.messageId || "sin-id");
    return { ok: true, messageId: info?.messageId || null };
  } catch (e) {
    console.error("[email] SMTP fallo:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/* ───────────────────────────────────────────────────────────── */

export async function sendVerificationEmail({ to, name, link }) {
  const html = `
    <p>Hola ${name ?? ""},</p>
    <p>Haz clic para verificar tu correo:</p>
    <p><a href="${link}">${link}</a></p>
    <p style="color:#718096;font-size:12px">
      Si no solicitaste este correo, puedes ignorarlo.
    </p>
  `;
  return sendMailSafe({
    to,
    subject: "Verifica tu correo | Intranet Odes",
    html,
  });
}

/* ───────────────────────────────────────────────────────────── */

const fmtMX = (date) =>
  new Date(date).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
  });

export async function sendVacationApprovedEmail({
  to,
  name,
  startDate,
  endDate,
  approverName,
}) {
  const subject = "✅ Vacaciones aprobadas";
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2>Vacaciones aprobadas</h2>
      <p>Hola <strong>${name ?? ""}</strong>,</p>
      <p>Tu solicitud fue <strong>APROBADA</strong>.</p>
      <p><strong>Fechas:</strong><br>
        ${fmtMX(startDate)} — ${fmtMX(endDate)}
      </p>
      <p>Aprobado por: ${approverName || "Recursos Humanos"}</p>
    </div>
  `;
  return sendMailSafe({ to, subject, html });
}

export async function sendVacationRejectedEmail({
  to,
  name,
  startDate,
  endDate,
  reason,
  approverName,
}) {
  const subject = "❌ Vacaciones rechazadas";
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2>Vacaciones rechazadas</h2>
      <p>Hola <strong>${name ?? ""}</strong>,</p>
      <p>Tu solicitud fue <strong>RECHAZADA</strong>.</p>
      <p><strong>Fechas:</strong><br>
        ${fmtMX(startDate)} — ${fmtMX(endDate)}
      </p>
      <p><strong>Motivo:</strong> ${reason || "No especificado"}</p>
      <p>Revisado por: ${approverName || "Recursos Humanos"}</p>
    </div>
  `;
  return sendMailSafe({ to, subject, html });
}

/* ───────────────────────────────────────────────────────────── */

export const sendEmail = (options) => sendMailSafe(options);

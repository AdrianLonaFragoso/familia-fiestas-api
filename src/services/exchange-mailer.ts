import nodemailer from "nodemailer";
import { getEnv } from "../config/env.js";
import { unprocessable } from "../lib/http-error.js";

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId: string;
};
type MailSender = (mail: Mail) => Promise<void>;
let testSender: MailSender | undefined;
export function setExchangeSenderForTests(sender: MailSender | undefined) {
  if (getEnv().NODE_ENV !== "test") throw Error("Solo disponible en pruebas.");
  testSender = sender;
}
export function exchangeMailConfigured() {
  const env = getEnv();
  return !!(env.SMTP_USER && env.SMTP_APP_PASSWORD);
}
export async function sendExchangeMail(mail: Mail) {
  if (getEnv().NODE_ENV === "test") {
    if (!testSender) throw Error("Pruebas sin transporte de correo simulado.");
    return testSender(mail);
  }
  const env = getEnv();
  if (!env.SMTP_USER || !env.SMTP_APP_PASSWORD)
    throw unprocessable("Falta configurar la cuenta de Gmail del backend.");
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.SMTP_USER, pass: env.SMTP_APP_PASSWORD },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    const result = await transport.sendMail({
      ...mail,
      from: { name: "Eventos LOVE", address: env.SMTP_USER },
    });
    if (!result.accepted?.length)
      throw Object.assign(Error("Correo no aceptado."), { responseCode: 550 });
  } finally {
    transport.close();
  }
}
export function mailFailure(error: unknown) {
  const e = error as { code?: string; responseCode?: number; command?: string };
  const definite =
    !!e.responseCode ||
    ["EAUTH", "EDNS", "ENOTFOUND", "ECONNREFUSED"].includes(e.code ?? "");
  return {
    status: definite ? "failed" : "uncertain",
    message: definite
      ? "Gmail no aceptó el envío. Revisa la configuración o la dirección antes de reintentar."
      : "No se pudo confirmar si Gmail aceptó el correo. Revisa Enviados en Gmail antes de volver a enviarlo.",
  } as const;
}

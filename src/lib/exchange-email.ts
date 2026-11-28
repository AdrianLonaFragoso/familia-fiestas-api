export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

/** Texto de invitados escapado; solo enlaces http(s), sin imágenes ni HTML suministrado por ellos. */
export function giftLinksHtml(text: string) {
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
  let output = "",
    cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    let link = raw.replace(/[.,;!?:]+$/, "");
    while (
      link.endsWith(")") &&
      (link.match(/\)/g)?.length ?? 0) > (link.match(/\(/g)?.length ?? 0)
    )
      link = link.slice(0, -1);
    output += escapeHtml(text.slice(cursor, match.index));
    try {
      const url = new URL(link.startsWith("www.") ? `https://${link}` : link);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        throw Error();
      output += `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" style="color:#530c83;text-decoration:underline;word-break:break-all;">${escapeHtml(link)}</a>${escapeHtml(raw.slice(link.length))}`;
    } catch {
      output += escapeHtml(raw);
    }
    cursor = match.index! + raw.length;
  }
  return (output + escapeHtml(text.slice(cursor))).replace(/\r?\n/g, "<br>");
}
export type ExchangeEmail = {
  giverName: string;
  recipientName: string;
  giftSuggestions: string;
  eventName: string;
  dateLabel: string;
  rules: string | null;
  profileUrl: string;
};
export function exchangeEmail(input: ExchangeEmail) {
  const {
    giverName,
    recipientName,
    giftSuggestions,
    eventName,
    dateLabel,
    rules,
    profileUrl,
  } = input;
  const subject = `Tu intercambio de ${eventName} · Eventos LOVE`;
  const text = `¡Hola, ${giverName}!\n\nEn el intercambio de ${eventName} te tocó regalarle a ${recipientName}.\n${dateLabel}\n\nSus opciones de regalo:\n${giftSuggestions}\n${rules ? "\nBases del intercambio:\n" + rules + "\n" : ""}\nConsulta tu resultado en tu perfil:\n${profileUrl}\n\nGuarda este correo. ¡Nos encantará celebrar contigo!`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f5f0e8;font-family:Arial,Helvetica,sans-serif;color:#241b18;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4dbcf;"><tr><td style="padding:26px 28px;background-color:#530c83;color:#ffffff;"><img src="https://familia-fiestas-2026.vercel.app/social/eventos-love-v1.png" alt="Eventos LOVE" width="220" height="110" border="0" style="display:block;width:220px;max-width:100%;height:auto;margin:0 0 20px;border:0;"><h1 style="margin:0;font-size:28px;line-height:36px;color:#ffffff;">¡Ya tienes a quién regalar! ❤️</h1></td></tr><tr><td style="padding:28px;"><h2 style="margin:0 0 16px;font-size:23px;line-height:30px;color:#315540;">¡Hola, ${escapeHtml(giverName)}!</h2><p style="margin:0 0 8px;font-size:16px;line-height:25px;">Este es tu resultado del intercambio de <strong>${escapeHtml(eventName)}</strong>.</p><p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#655c56;">${escapeHtml(dateLabel)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#fff4cf;border:1px solid #e8ce78;padding:20px;"><p style="margin:0 0 8px;font-size:14px;">Te tocó regalarle a</p><p style="margin:0;font-size:25px;line-height:33px;color:#530c83;font-weight:bold;">${escapeHtml(recipientName)}</p></td></tr></table><h3 style="margin:24px 0 12px;font-size:19px;color:#315540;">Sus opciones de regalo 🎁</h3><p style="margin:0 0 24px;font-size:16px;line-height:26px;word-break:break-word;">${giftLinksHtml(giftSuggestions)}</p>${rules ? `<h3 style="margin:0 0 10px;font-size:17px;color:#315540;">Bases del intercambio</h3><p style="margin:0 0 24px;font-size:14px;line-height:23px;">${giftLinksHtml(rules)}</p>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#315540;padding:14px 22px;"><a href="${escapeHtml(profileUrl)}" style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">Consultar mi resultado →</a></td></tr></table><p style="margin:20px 0 8px;font-size:14px;line-height:23px;color:#655c56;">Entra con tu clave personal. Guarda este correo para tener a mano tu asignación y sus opciones de regalo.</p><p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;"><a href="${escapeHtml(profileUrl)}" style="color:#530c83;">${escapeHtml(profileUrl)}</a></p></td></tr><tr><td style="padding:20px 28px;background-color:#f8f5ef;font-size:14px;line-height:23px;color:#655c56;">Un regalo pensado con cariño hace la diferencia.<br><strong style="color:#530c83;">¡Nos vemos para celebrar! ✨</strong></td></tr></table></td></tr></table>`;
  return { subject, text, html };
}

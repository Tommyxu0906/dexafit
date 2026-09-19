/**
 * One place that turns an email's content into a text and an HTML body.
 *
 * Every notification renders through here so escaping is applied in exactly one
 * place: a provider's display name reaches these templates unmodified, and a
 * name is a field a stranger can type anything into.
 */

export type EmailBody = { text: string; html: string };

export type EmailContent = {
  paragraphs: string[];
  rows?: Array<[string, string]>;
  cta?: { label: string; url: string };
  footer?: string;
};

export function renderEmailBody(content: EmailContent): EmailBody {
  const { paragraphs, rows = [], cta, footer } = content;

  const text = [
    // Blank lines between paragraphs; without them a plain-text client runs the
    // greeting straight into the first sentence.
    paragraphs.join("\n\n"),
    ...(rows.length > 0
      ? ["", ...rows.map(([label, value]) => `${label.padEnd(14)}${value}`)]
      : []),
    ...(cta ? ["", `${cta.label}:`, cta.url] : []),
    ...(footer ? ["", footer] : []),
  ].join("\n");

  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    ...(rows.length > 0
      ? [
          `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">`,
          ...rows.map(
            ([label, value]) =>
              `<tr><td style="padding:2px 16px 2px 0;color:#64748b">${escapeHtml(label)}</td>` +
              `<td style="padding:2px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
          ),
          `</table>`,
        ]
      : []),
    ...(cta
      ? [
          `<p style="margin-top:20px"><a href="${escapeHtml(cta.url)}" style="background:#047857;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`,
        ]
      : []),
    ...(footer
      ? [`<p style="color:#64748b;font-size:12px">${escapeHtml(footer)}</p>`]
      : []),
    `</div>`,
  ].join("");

  return { text, html };
}

/**
 * Note: `timeZoneName` cannot be combined with `dateStyle`/`timeStyle` — that
 * combination throws, and the fallback below would quietly put a raw ISO
 * timestamp in every notification. The fields are listed individually for that
 * reason.
 */
export function formatEastern(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

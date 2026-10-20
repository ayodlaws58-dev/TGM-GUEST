// Save as lib/host-checkin-email.ts in your project.

export type HostCheckInEmailData = {
  hostName: string;
  visitorName: string;
  visitorCompany?: string | null;
  purpose: string;
  checkInTime: string; // already formatted, e.g. "Oct 20, 9:05 AM"
  companyName?: string | null; // shown in the header, e.g. "TGM Education"
  logoUrl?: string | null; // must be a public https URL
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHostCheckInEmail(data: HostCheckInEmailData) {
  const host = esc(data.hostName);
  const visitor = esc(data.visitorName);
  const company = esc(data.visitorCompany?.trim() || "—");
  const purpose = esc(data.purpose);
  const time = esc(data.checkInTime);
  const brand = esc(data.companyName?.trim() || "Reception");
  const logo = data.logoUrl
    ? `<img src="${esc(data.logoUrl)}" alt="${brand}" height="40" style="display:block;border:0;height:40px;width:auto;">`
    : `<span style="color:#ffffff;font-size:16px;font-weight:600;">${brand}</span>`;

  const row = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:10px 14px;color:#616e7c;width:120px;${last ? "" : "border-bottom:1px solid #e4e7eb;"}">${label}</td>
      <td style="padding:10px 14px;${last ? "" : "border-bottom:1px solid #e4e7eb;"}">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your visitor has arrived</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${visitor} has checked in and is waiting for you.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1f3a5f;padding:20px 28px;">${logo}</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">Your visitor has arrived</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Hi ${host}, <strong>${visitor}</strong> has been approved and is waiting for you at reception.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e7eb;border-radius:6px;font-size:14px;">
            ${row("Visitor", visitor)}
            ${row("Company", company)}
            ${row("Purpose", purpose)}
            ${row("Checked in", time, true)}
          </table>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#616e7c;">Automated message from reception. Please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "Your visitor has arrived",
    "",
    `Hi ${data.hostName},`,
    `${data.visitorName} has been approved and is waiting for you at reception.`,
    "",
    `Visitor:    ${data.visitorName}`,
    `Company:    ${data.visitorCompany?.trim() || "-"}`,
    `Purpose:    ${data.purpose}`,
    `Checked in: ${data.checkInTime}`,
    "",
    "--",
    `${data.companyName?.trim() || "Reception"}`,
    "Automated message. Please do not reply.",
  ].join("\n");

  return {
    subject: `${data.visitorName} has arrived to see you`,
    html,
    text,
  };
}

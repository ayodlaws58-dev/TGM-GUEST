// Email template for host availability notifications

export type HostAvailabilityEmailData = {
  hostName: string;
  updateType: "not_available" | "busy" | "need_time";
  message: string;
  companyName?: string | null;
  logoUrl?: string | null;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getUpdateTypeLabel(type: string): string {
  switch (type) {
    case "not_available":
      return "Not Available";
    case "busy":
      return "Busy";
    case "need_time":
      return "Needs Time";
    default:
      return type;
  }
}

function getUpdateTypeColor(type: string): string {
  switch (type) {
    case "not_available":
      return "#dc3545";
    case "busy":
      return "#ff9800";
    case "need_time":
      return "#2196f3";
    default:
      return "#666";
  }
}

export function renderHostAvailabilityEmail(data: HostAvailabilityEmailData) {
  const hostName = esc(data.hostName);
  const message = esc(data.message);
  const typeLabel = getUpdateTypeLabel(data.updateType);
  const typeColor = getUpdateTypeColor(data.updateType);
  const brand = esc(data.companyName?.trim() || "Reception");
  const logo = data.logoUrl
    ? `<img src="${esc(data.logoUrl)}" alt="${brand}" height="40" style="display:block;border:0;height:40px;width:auto;">`
    : `<span style="color:#ffffff;font-size:16px;font-weight:600;">${brand}</span>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Host Availability Update</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2933;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${hostName} has sent an availability update.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#1f3a5f;padding:20px 28px;">${logo}</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">Availability Update</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;"><strong>${hostName}</strong> has sent an availability update.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e7eb;border-radius:6px;font-size:14px;">
            <tr>
              <td style="padding:10px 14px;color:#616e7c;width:120px;border-bottom:1px solid #e4e7eb;">Status</td>
              <td style="padding:10px 14px;border-bottom:1px solid #e4e7eb;"><span style="background-color:${typeColor};color:white;padding:4px 8px;border-radius:4px;font-weight:600;">${typeLabel}</span></td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#616e7c;width:120px;">Message</td>
              <td style="padding:10px 14px;">${message}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#616e7c;">Automated message from reception. Please do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "Availability Update",
    "",
    `Hi Manager,`,
    `${data.hostName} has sent an availability update.`,
    "",
    `Status: ${typeLabel}`,
    `Message: ${data.message}`,
    "",
    "--",
    `${data.companyName?.trim() || "Reception"}`,
    "Automated message. Please do not reply.",
  ].join("\n");

  return {
    subject: `${hostName} - ${typeLabel}`,
    html,
    text,
  };
}

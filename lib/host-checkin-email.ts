// Professional visitor arrival email template with interactive response buttons

export type HostCheckInEmailData = {
  hostName: string;
  visitorName: string;
  visitorCompany?: string | null;
  purpose: string;
  checkInTime: string;
  receptionLocation?: string;
  companyName?: string | null;
  companyAddress?: string | null;
  logoUrl?: string | null;
  responseYesUrl?: string | null;
  responseMaybeUrl?: string | null;
  responseNoUrl?: string | null;
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
  const location = esc(data.receptionLocation?.trim() || "Reception");
  const brand = esc(data.companyName?.trim() || "Reception");
  const address = esc(data.companyAddress?.trim() || "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your visitor has arrived</title>
  <style>
    @media (prefers-color-scheme: dark) {
      li::marker { color: #c4c4c4; }
    }
    .button {
      display: inline-block;
      padding: 12px 16px;
      border-radius: 4px;
      font-weight: 500;
      font-size: 14px;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
    }
    .button-yes {
      background-color: #000000;
      color: #ffffff;
    }
    .button-maybe, .button-no {
      background-color: #ffffff;
      color: #000000;
      border: 1px solid #000000;
    }
    .divider {
      border: none;
      border-top: 2px solid #eaeaea;
      margin: 24px 0;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e2e2e2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;color:#1f2933;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="background-color:#e2e2e2;">
    <tr><td align="center" style="padding: 20px;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" align="center" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.4;font-weight:600;">Your visitor has arrived</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">Hi ${host},</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;"><strong>${visitor}</strong> from <strong>${company}</strong> has checked in and is waiting for you. Please come meet them at reception.</p>

          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f5;border-radius:6px;margin:20px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:14px;line-height:1.6;">
                <strong>Visitor:</strong> ${visitor}<br/>
                <strong>Company:</strong> ${company}<br/>
                <strong>Purpose:</strong> ${purpose}<br/>
                <strong>Checked in:</strong> ${time}<br/>
                <strong>Location:</strong> ${location}
              </p>
            </td></tr>
          </table>

          <p style="margin:0 0 20px;font-size:16px;line-height:1.5;"><strong>Can you meet them now? Let reception know with one tap:</strong></p>

          <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
            <tr>
              <td style="padding:0 8px 0 0;width:33%;">
                <a href="#" style="display:inline-block;width:100%;padding:12px 16px;background-color:#000000;color:#ffffff;border-radius:4px;font-weight:500;font-size:14px;text-align:center;text-decoration:none;box-sizing:border-box;cursor:pointer;" onclick="return false;">Yes, I can meet</a>
              </td>
              <td style="padding:0 4px;width:33%;">
                <a href="#" style="display:inline-block;width:100%;padding:12px 16px;background-color:#ffffff;color:#000000;border:1px solid #000000;border-radius:4px;font-weight:500;font-size:14px;text-align:center;text-decoration:none;box-sizing:border-box;cursor:pointer;" onclick="return false;">Maybe, running late</a>
              </td>
              <td style="padding:0 0 0 4px;width:33%;">
                <a href="#" style="display:inline-block;width:100%;padding:12px 16px;background-color:#ffffff;color:#000000;border:1px solid #000000;border-radius:4px;font-weight:500;font-size:14px;text-align:center;text-decoration:none;box-sizing:border-box;cursor:pointer;" onclick="return false;">No, I can't</a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#666666;">If you are unable to meet them, please let the reception team know.</p>

          <hr class="divider" style="border:none;border-top:2px solid #eaeaea;margin:24px 0;"/>

          <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
            ${brand}${address ? ' • ' + address : ''}<br/>
            © 2026 ${brand}
          </p>
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
    `${data.visitorName} from ${data.visitorCompany?.trim() || "-"} has checked in and is waiting for you at reception.`,
    "",
    `Visitor:    ${data.visitorName}`,
    `Company:    ${data.visitorCompany?.trim() || "-"}`,
    `Purpose:    ${data.purpose}`,
    `Checked in: ${data.checkInTime}`,
    `Location:   ${data.receptionLocation?.trim() || "Reception"}`,
    "",
    "Can you meet them now?",
    data.responseYesUrl ? `Yes: ${data.responseYesUrl}` : "",
    data.responseMaybeUrl ? `Maybe: ${data.responseMaybeUrl}` : "",
    data.responseNoUrl ? `No: ${data.responseNoUrl}` : "",
    "",
    "If you are unable to meet them, please let the reception team know.",
    "",
    "--",
    `${data.companyName?.trim() || "Reception"}`,
    data.companyAddress?.trim() || "",
    "Automated message. Please do not reply.",
  ].filter(line => line !== "").join("\n");

  return {
    subject: `${data.visitorName} has arrived to see you`,
    html,
    text,
  };
}

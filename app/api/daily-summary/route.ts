import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// West Africa Time (Africa/Lagos) is UTC+1 all year with no daylight saving.
const WAT_OFFSET_MS = 60 * 60 * 1000;

type SummaryGuest = {
  name: string;
  email: string;
  phone: string | null;
  company: string;
  host_name: string;
  purpose: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

const watFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatWat(value: string | null) {
  return value ? watFormatter.format(new Date(value)) : "";
}

function csvCell(value: string | null) {
  let text = value ?? "";
  // Prevent spreadsheet formula injection from visitor-supplied text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(guests: SummaryGuest[]) {
  const header = ["Name", "Email", "Phone", "Company", "Host", "Purpose", "Status", "Checked in", "Checked out"];
  const rows = guests.map((guest) => [
    guest.name, guest.email, guest.phone, guest.company, guest.host_name, guest.purpose,
    guest.status.replace("_", " "), formatWat(guest.checked_in_at), formatWat(guest.checked_out_at),
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

function secretMatches(provided: string | null, expected: string) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const cronSecret = process.env.CRON_SECRET;
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !resendFromEmail || !cronSecret) {
    return NextResponse.json({ error: "Daily summary is not configured." }, { status: 503 });
  }
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  if (!secretMatches(bearer, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const watNow = new Date(Date.now() + WAT_OFFSET_MS);
  const dayStartUtc = Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate()) - WAT_OFFSET_MS;
  const start = new Date(dayStartUtc).toISOString();
  const end = new Date(dayStartUtc + 24 * 60 * 60 * 1000).toISOString();
  const dateLabel = watNow.toISOString().slice(0, 10);

  const server = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const resend = new Resend(resendApiKey);

  const { data: workspaces, error: workspaceError } = await server.from("workspaces").select("owner_id, company_name");
  if (workspaceError) {
    console.error("Unable to load workspaces for the daily summary:", workspaceError.message);
    return NextResponse.json({ error: "Unable to load workspaces." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const workspace of workspaces ?? []) {
    const { data: adminData, error: adminError } = await server.auth.admin.getUserById(workspace.owner_id);
    const adminEmail = adminData?.user?.email;
    if (adminError || !adminEmail) {
      failed += 1;
      continue;
    }
    const { data, error } = await server
      .from("guests")
      .select("name, email, phone, company, host_name, purpose, status, checked_in_at, checked_out_at")
      .eq("owner_id", workspace.owner_id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Unable to load visitors for the daily summary:", error.message);
      failed += 1;
      continue;
    }
    const guests = data as SummaryGuest[];
    const checkedIn = guests.filter((guest) => guest.status === "checked_in").length;
    const checkedOut = guests.filter((guest) => guest.status === "checked_out").length;
    const pending = guests.filter((guest) => guest.status === "pending_approval").length;

    const { error: sendError } = await resend.emails.send({
      from: resendFromEmail,
      to: [adminEmail],
      subject: `${workspace.company_name} visitor summary for ${dateLabel}`,
      text: [
        `Daily visitor summary for ${workspace.company_name} (${dateLabel}, West Africa Time)`,
        "",
        `Total visitor requests: ${guests.length}`,
        `Still on site: ${checkedIn}`,
        `Checked out: ${checkedOut}`,
        `Awaiting approval: ${pending}`,
        "",
        "The full list is attached as a CSV file.",
      ].join("\n"),
      attachments: [{ filename: `visitors-${dateLabel}.csv`, content: Buffer.from(buildCsv(guests), "utf-8") }],
    }, { idempotencyKey: `tgm-daily-summary-${workspace.owner_id}-${dateLabel}` });
    if (sendError) {
      console.error("Unable to send the daily summary:", sendError.message);
      failed += 1;
    } else {
      sent += 1;
    }
  }

  return NextResponse.json({ sent, failed }, { status: failed > 0 && sent === 0 ? 502 : 200 });
}

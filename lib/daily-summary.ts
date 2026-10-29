import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";

// West Africa Time (Africa/Lagos) is UTC+1 all year with no daylight saving.
const WAT_OFFSET_MS = 60 * 60 * 1000;

type SummaryGuest = {
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  host_name: string;
  purpose: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checkout_method: string | null;
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
  const header = ["Name", "Email", "Phone", "Company", "Host", "Purpose", "Status", "Checked in", "Checked out", "Check-out method"];
  const rows = guests.map((guest) => [
    guest.name, guest.email ?? "", guest.phone, guest.company, guest.host_name, guest.purpose,
    guest.status.replace("_", " "), formatWat(guest.checked_in_at), formatWat(guest.checked_out_at),
    guest.status === "checked_out" ? (guest.checkout_method === "self" ? "Self" : "Assisted") : "",
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export async function sendWorkspaceSummary(options: {
  server: SupabaseClient;
  resend: Resend;
  from: string;
  ownerId: string;
  companyName: string;
  to: string;
  idempotencyKey?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { server, resend, from, ownerId, companyName, to, idempotencyKey } = options;
  const watNow = new Date(Date.now() + WAT_OFFSET_MS);
  const dayStartUtc = Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate()) - WAT_OFFSET_MS;
  const start = new Date(dayStartUtc).toISOString();
  const end = new Date(dayStartUtc + 24 * 60 * 60 * 1000).toISOString();
  const dateLabel = watNow.toISOString().slice(0, 10);

  const { data, error } = await server
    .from("guests")
    .select("name, email, phone, company, host_name, purpose, status, checked_in_at, checked_out_at, checkout_method")
    .eq("owner_id", ownerId)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Unable to load visitors for the daily summary:", error.message);
    return { ok: false, error: "Unable to load today's visitors." };
  }
  const guests = data as SummaryGuest[];
  const checkedIn = guests.filter((guest) => guest.status === "checked_in").length;
  const checkedOut = guests.filter((guest) => guest.status === "checked_out").length;
  const selfCheckedOut = guests.filter((guest) => guest.status === "checked_out" && guest.checkout_method === "self").length;
  const pending = guests.filter((guest) => guest.status === "pending_approval").length;

  const { error: sendError } = await resend.emails.send({
    from,
    to: [to],
    subject: `${companyName} visitor summary for ${dateLabel}`,
    text: [
      `Daily visitor summary for ${companyName} (${dateLabel}, West Africa Time)`,
      "",
      `Total visitor requests: ${guests.length}`,
      `Still on site: ${checkedIn}`,
      `Checked out: ${checkedOut} (${selfCheckedOut} self, ${checkedOut - selfCheckedOut} assisted)`,
      `Awaiting approval: ${pending}`,
      "",
      "The full list is attached as a CSV file.",
    ].join("\n"),
    attachments: [{ filename: `visitors-${dateLabel}.csv`, content: Buffer.from(buildCsv(guests), "utf-8") }],
  }, idempotencyKey ? { idempotencyKey } : undefined);
  if (sendError) {
    console.error("Unable to send the daily summary:", sendError.message);
    return { ok: false, error: `Unable to send the summary email: ${sendError.message}` };
  }
  return { ok: true };
}

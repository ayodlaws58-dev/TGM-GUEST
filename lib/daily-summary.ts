import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { buildVisitorCsv, WAT_OFFSET_MS, type ReportGuest } from "./report-format";

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
  const guests = data as ReportGuest[];
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
    attachments: [{ filename: `visitors-${dateLabel}.csv`, content: Buffer.from(buildVisitorCsv(guests), "utf-8") }],
  }, idempotencyKey ? { idempotencyKey } : undefined);
  if (sendError) {
    console.error("Unable to send the daily summary:", sendError.message);
    return { ok: false, error: `Unable to send the summary email: ${sendError.message}` };
  }
  return { ok: true };
}

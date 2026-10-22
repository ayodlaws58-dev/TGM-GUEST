import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendWorkspaceSummary } from "../../../lib/daily-summary";

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

  const dateLabel = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
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
    const result = await sendWorkspaceSummary({
      server,
      resend,
      from: resendFromEmail,
      ownerId: workspace.owner_id,
      companyName: workspace.company_name,
      to: adminEmail,
      idempotencyKey: `tgm-daily-summary-${workspace.owner_id}-${dateLabel}`,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ sent, failed }, { status: failed > 0 && sent === 0 ? 502 : 200 });
}

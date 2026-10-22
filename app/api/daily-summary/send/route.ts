import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sendWorkspaceSummary } from "../../../../lib/daily-summary";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!supabaseUrl || !supabaseAnonKey) return jsonError("Summary email requires Supabase configuration.", 503);
  if (!resendApiKey || !resendFromEmail || !serviceRoleKey) {
    return jsonError("Email delivery is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL and SUPABASE_SERVICE_ROLE_KEY.", 503);
  }
  if (!accessToken) return jsonError("Sign in as a workspace administrator to send the summary.", 401);

  const auth = { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false };
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { auth });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData.user?.email) return jsonError("Your session is invalid or expired. Please sign in again.", 401);

  const server = createClient(supabaseUrl, serviceRoleKey, { auth });
  // Only the workspace owner (admin) may send; reception members have no workspace row of their own.
  const { data: workspace, error: workspaceError } = await server
    .from("workspaces")
    .select("owner_id, company_name")
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (workspaceError) return jsonError("Unable to load your workspace.", 500);
  if (!workspace) return jsonError("Only workspace administrators can send the summary.", 403);

  const result = await sendWorkspaceSummary({
    server,
    resend: new Resend(resendApiKey),
    from: resendFromEmail,
    ownerId: workspace.owner_id,
    companyName: workspace.company_name,
    to: userData.user.email,
  });
  if (!result.ok) return jsonError(result.error, 502);
  return NextResponse.json({ sent: true, to: userData.user.email });
}

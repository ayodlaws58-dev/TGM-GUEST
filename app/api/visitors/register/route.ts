import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyTurnstile } from "../../../../lib/turnstile";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RegisterInput = {
  turnstile_token?: unknown;
  reception_token?: unknown;
  first_name?: unknown;
  middle_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  host_name?: unknown;
  purpose?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return jsonError("Check-in is not configured. Please ask reception for help.", 503);

  let input: RegisterInput;
  try {
    input = await request.json() as RegisterInput;
  } catch {
    return jsonError("Enter valid visitor details.", 400);
  }

  const receptionToken = text(input.reception_token);
  if (!uuidPattern.test(receptionToken)) return jsonError("This reception QR code is invalid. Please ask the front desk for help.", 404);

  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (accessToken) {
    // Signed-in reception staff adding a visitor from the dashboard skip the CAPTCHA,
    // but only for the workspace their account belongs to.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) return jsonError("Check-in is not configured. Please ask reception for help.", 503);
    const staffClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { data: access, error: accessError } = await staffClient.rpc("get_my_reception_access");
    const workspace = access?.[0] as { reception_token?: string } | undefined;
    if (accessError || workspace?.reception_token?.toLowerCase() !== receptionToken.toLowerCase()) {
      return jsonError("Sign in as reception staff for this workspace to add visitors.", 403);
    }
  } else {
    const captcha = await verifyTurnstile(input.turnstile_token, request);
    if (!captcha.ok) {
      if (captcha.reason === "missing-token") return jsonError("Please complete the security check and try again.", 400);
      if (captcha.reason === "rejected") return jsonError("The security check failed or expired. Please try again.", 403);
      return jsonError("The security check is unavailable right now. Please ask reception for help.", 503);
    }
  }

  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await serverClient.rpc("register_visitor_by_qr", {
    reception_token: receptionToken.toLowerCase(),
    visitor_first_name: text(input.first_name),
    visitor_middle_name: text(input.middle_name) || null,
    visitor_last_name: text(input.last_name),
    visitor_email: text(input.email),
    visitor_phone: text(input.phone),
    visitor_company: text(input.company),
    visitor_host: text(input.host_name),
    visit_purpose: text(input.purpose),
  });
  if (error) {
    // The RPC raises plain-language validation messages (bad email, unknown host, and so on).
    const userFacing = /^(Enter valid|Choose an employee)/.test(error.message);
    if (!userFacing) console.error("Unable to register a visitor:", error.message);
    return jsonError(userFacing ? error.message : "Unable to check you in. Please ask the front desk for help.", userFacing ? 400 : 503);
  }

  const visitor = data?.[0];
  if (!visitor) return jsonError("This reception QR code is invalid. Please ask the front desk for help.", 404);
  return NextResponse.json(visitor);
}

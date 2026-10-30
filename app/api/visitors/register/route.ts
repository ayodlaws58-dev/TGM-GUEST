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
const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Mirrors the database rules so the visitor is told exactly which field to fix.
function validateVisitor(input: RegisterInput): string | null {
  const first = text(input.first_name).trim();
  const middle = text(input.middle_name).trim();
  const last = text(input.last_name).trim();
  const email = text(input.email).trim();
  const phone = text(input.phone).trim();
  const host = text(input.host_name).trim();
  const purpose = text(input.purpose).trim();

  if (!first || !last) return "Enter your first and last name.";
  if (first.length > 120 || middle.length > 120 || last.length > 120 || [first, middle, last].filter(Boolean).join(" ").length > 120) {
    return "Your name is too long. Please use 120 characters or fewer.";
  }
  if (email && (email.length > 254 || !emailPattern.test(email))) return "That email address doesn't look right. Fix it, or leave the email blank.";
  if (!phone) return "Enter your phone number.";
  if (phone.length > 32) return "Your phone number is too long. Please use 32 characters or fewer.";
  if (text(input.company).length > 120) return "The company name is too long. Please use 120 characters or fewer.";
  if (!host) return "Choose who you are visiting.";
  if (!purpose) return "Choose the purpose of your visit.";
  if (purpose.length > 240) return "The purpose of your visit is too long. Please use 240 characters or fewer.";
  return null;
}

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

  const problem = validateVisitor(input);
  if (problem) return jsonError(problem, 400);

  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await serverClient.rpc("register_visitor_by_qr", {
    reception_token: receptionToken.toLowerCase(),
    visitor_first_name: text(input.first_name),
    visitor_middle_name: text(input.middle_name) || null,
    visitor_last_name: text(input.last_name),
    visitor_email: text(input.email).trim(),
    visitor_phone: text(input.phone),
    visitor_company: text(input.company),
    visitor_host: text(input.host_name),
    visit_purpose: text(input.purpose),
  });
  if (error) {
    if (/^Choose an employee/.test(error.message)) return jsonError("That person isn't in the employee directory. Please choose someone from the list.", 400);
    // Every field was checked above, so the database's generic "Enter valid visitor details" means the
    // database is out of date. The likely cause is a blank email on a database that still requires one.
    if (/^Enter valid/.test(error.message)) {
      console.error("Database rejected a visitor that passed validation. Apply the email-optional migration (supabase/migrations/20261030090000_make_visitor_email_optional.sql):", error.message);
      return jsonError(
        text(input.email).trim()
          ? "We couldn't check you in with those details. Please ask the front desk for help."
          : "An email address is required right now. Please enter one, or ask the front desk for help.",
        400,
      );
    }
    console.error("Unable to register a visitor:", error.message);
    return jsonError("Unable to check you in. Please ask the front desk for help.", 503);
  }

  const visitor = data?.[0];
  if (!visitor) return jsonError("This reception QR code is invalid. Please ask the front desk for help.", 404);
  return NextResponse.json(visitor);
}

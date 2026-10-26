// Server-side Cloudflare Turnstile verification. Import only from route handlers.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "not-configured" | "rejected" | "unreachable" };

export async function verifyTurnstile(token: unknown, request: Request): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "not-configured" };
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { ok: false, reason: "unreachable" };
    const result = await response.json() as { success?: boolean; "error-codes"?: string[] };
    if (result.success === true) return { ok: true };
    console.warn("Turnstile rejected a token:", (result["error-codes"] ?? []).join(", "));
    return { ok: false, reason: "rejected" };
  } catch (cause) {
    console.error("Unable to reach Turnstile:", cause instanceof Error ? cause.message : cause);
    return { ok: false, reason: "unreachable" };
  }
}

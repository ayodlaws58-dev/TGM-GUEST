"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getReceptionCompanyName,
  getVisitStatus,
  listReceptionHosts,
  registerVisitor,
  VISIT_PURPOSES,
  type GuestStatus,
} from "../../../lib/guests";
import TurnstileWidget, { type TurnstileHandle } from "../../components/TurnstileWidget";

type VisitReceipt = {
  name: string;
  company: string;
  host_name: string;
  status: GuestStatus;
  checked_in_at: string | null;
  visit_token: string;
};

export default function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hosts, setHosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);
  useEffect(() => {
    let active = true;
    params.then(async ({ token: receptionToken }) => {
      const [name, hostNames] = await Promise.all([
        getReceptionCompanyName(receptionToken),
        listReceptionHosts(receptionToken),
      ]);
      if (!name) throw new Error("This reception QR code is invalid. Please ask the front desk for help.");
      const savedVisit = window.localStorage.getItem(`tgm-visit:${receptionToken}`);
      if (savedVisit) {
        const visit = await getVisitStatus(savedVisit).catch(() => null);
        if (visit?.status === "checked_in") {
          router.replace(`/check-in/${encodeURIComponent(receptionToken)}/visit`);
          return;
        }
        if (visit?.status === "pending_approval" && active) {
          setReceipt({ ...visit, visit_token: savedVisit });
        } else if (visit) {
          window.localStorage.removeItem(`tgm-visit:${receptionToken}`);
        }
      }
      if (active) {
        setToken(receptionToken);
        setCompanyName(name);
        setHosts(hostNames);
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load the visitor form.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [params]);

  const visitToken = receipt?.visit_token;
  useEffect(() => {
    if (!token || !visitToken) return;
    window.localStorage.setItem(`tgm-visit:${token}`, visitToken);
    let active = true;
    const poll = async () => {
      try {
        const visit = await getVisitStatus(visitToken);
        if (active && visit?.status === "checked_in") router.replace(`/check-in/${encodeURIComponent(token)}/visit`);
      } catch {
        // Keep waiting; the next poll will retry.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, visitToken, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    // Split into the existing first/middle/last columns.
    const full_name = String(form.get("full_name") ?? "").trim().replace(/\s+/g, " ");
    const nameParts = full_name ? full_name.split(" ") : [];
    const first_name = nameParts[0] ?? "";
    const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const middle_name = nameParts.slice(1, -1).join(" ");
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const host_name = String(form.get("host_name") ?? "").trim();
    const purpose = String(form.get("purpose") ?? "").trim();
    if (!first_name || !last_name || !phone || !host_name || !purpose) {
      setError("Enter your full name (first and last) and complete all required fields to check in.");
      setSaving(false);
      return;
    }
    if (!captchaToken) {
      setError("Please complete the security check before requesting check-in.");
      setSaving(false);
      return;
    }

    try {
      const registered = await registerVisitor(token, {
        first_name,
        middle_name,
        last_name,
        email,
        phone,
        company: String(form.get("company") ?? "").trim(),
        host_name,
        purpose,
      }, { turnstileToken: captchaToken });
      if (!registered) {
        setError("This reception QR code is invalid. Please ask the front desk for help.");
        return;
      }
      setReceipt(registered);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check you in. Please ask the front desk for help.");
      // A Turnstile token is single-use, so get a fresh one for the retry.
      captchaRef.current?.reset();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="checkin-screen">
      <div className="checkin-top-brand"><Image className="checkin-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={200} height={63} priority /></div>
      <section className="checkin-card">
        <div className={`checkin-symbol ${receipt ? "success" : ""}`}><span>{receipt ? "✓" : "✳"}</span></div>
        <p className="eyebrow">{loading ? "COMPANY VISITOR CHECK-IN" : companyName.toUpperCase() || "COMPANY VISITOR CHECK-IN"}</p>
        {loading ? (
          <><h1>One moment</h1><p className="checkin-description">We&apos;re opening the visitor check-in form.</p><span className="spinner" /></>
        ) : error && !companyName ? (
          <><h1>Check-in unavailable</h1><p className="checkin-description">{error}</p></>
        ) : receipt ? (
          <><h1>Waiting for reception</h1><p className="checkin-description">Thank you, <strong>{receipt.name}</strong>. Reception will verify your visit and notify <strong>{receipt.host_name}</strong> when you&apos;re approved.</p><span className="welcome-badge">✓ &nbsp;Check-in request received</span></>
        ) : (
          <>
            <h1>Welcome to {companyName}</h1>
            <p className="checkin-description">Please share a few details. Reception will verify your arrival and notify your host.</p>
            <form className="guest-form visitor-form" onSubmit={handleSubmit}>
              <label>Full name<input name="full_name" autoComplete="name" placeholder="e.g. Jordan Taylor Lee" maxLength={120} required /></label>
              <label>Email address<span className="optional-label">Optional</span><input name="email" type="email" autoComplete="email" placeholder="jordan@company.com" maxLength={254} required /></label>
              <label>Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="e.g. +1 555 123 4567" maxLength={32} required /></label>
              <label>Company <span className="optional-label">Optional</span><input name="company" autoComplete="organization" placeholder="e.g. Acme Inc." maxLength={120} /></label>
              <label>Who are you visiting?<select name="host_name" required defaultValue=""><option value="" disabled>Select an employee</option>{hosts.map((host) => <option key={host} value={host}>{host}</option>)}</select></label>
              <label>Purpose of visit<select name="purpose" required defaultValue=""><option value="" disabled>Select a purpose</option>{VISIT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>
              <TurnstileWidget onToken={setCaptchaToken} onError={setError} handleRef={captchaRef} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button full-button confirm-checkin" disabled={saving || hosts.length === 0 || !captchaToken}>{saving ? <><span className="button-spinner" /> Submitting…</> : "Request check-in"}</button>
              {hosts.length === 0 && <p className="form-error">The employee directory is empty. Please speak with reception.</p>}
            </form>
          </>
        )}
      </section>
      <p className="checkin-footer">Need help? Please speak with the <strong>reception team</strong>.</p>
      <Link className="checkin-home-link" href="/">Powered by TGM Check-in</Link>
    </main>
  );
}

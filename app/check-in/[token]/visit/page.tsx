"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { checkoutVisit, getVisitStatus, type VisitStatus } from "../../../../lib/guests";

const HOUR_MS = 60 * 60 * 1000;

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export default function VisitPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [receptionToken, setReceptionToken] = useState("");
  const [visit, setVisit] = useState<VisitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [checkingOut, setCheckingOut] = useState(false);
  const [done, setDone] = useState(false);
  const [dismissedHour, setDismissedHour] = useState(0);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");
  const notifiedHour = useRef(0);

  useEffect(() => {
    if (typeof Notification === "undefined") setNotifyPermission("unsupported");
    else setNotifyPermission(Notification.permission);
  }, []);

  useEffect(() => {
    let active = true;
    params.then(async ({ token }) => {
      const visitToken = window.localStorage.getItem(`tgm-visit:${token}`);
      if (!visitToken) {
        router.replace(`/check-in/${encodeURIComponent(token)}`);
        return;
      }
      setReceptionToken(token);
      const status = await getVisitStatus(visitToken);
      if (!active) return;
      if (!status || status.status === "pending_approval") {
        if (!status) window.localStorage.removeItem(`tgm-visit:${token}`);
        router.replace(`/check-in/${encodeURIComponent(token)}`);
        return;
      }
      setVisit(status);
      setDone(status.status === "checked_out");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load your visit.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [params, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const checkedInAt = visit?.checked_in_at ? new Date(visit.checked_in_at).getTime() : null;
  const elapsed = checkedInAt ? now - checkedInAt : 0;
  const hours = done ? 0 : Math.floor(elapsed / HOUR_MS);

  useEffect(() => {
    if (hours < 1 || notifiedHour.current === hours) return;
    const firstCheck = notifiedHour.current === 0;
    notifiedHour.current = hours;
    // Skip the popup when reopening an old visit; the on-page banner still shows.
    if (firstCheck && elapsed - hours * HOUR_MS > 60_000) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Time to check out?", {
        body: `You've been here for ${hours} hour${hours === 1 ? "" : "s"}. Please check out when you leave.`,
        icon: "/tgm-logo.jpg",
        tag: "tgm-checkout-reminder",
      });
    }
  }, [hours, elapsed]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    setNotifyPermission(await Notification.requestPermission());
  }

  async function handleCheckout() {
    const visitToken = window.localStorage.getItem(`tgm-visit:${receptionToken}`);
    if (!visitToken) return;
    setCheckingOut(true);
    setError("");
    try {
      if (!await checkoutVisit(visitToken)) throw new Error("Your visit could not be checked out. Please ask reception for help.");
      window.localStorage.removeItem(`tgm-visit:${receptionToken}`);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check out. Please ask reception for help.");
    } finally {
      setCheckingOut(false);
    }
  }

  const showReminder = !done && hours >= 1 && dismissedHour < hours;

  return (
    <main className="checkin-screen">
      <div className="checkin-top-brand"><Image className="checkin-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={200} height={63} priority /></div>
      <section className="checkin-card">
        {loading ? (
          <><h1>One moment</h1><p className="checkin-description">Loading your visit.</p><span className="spinner" /></>
        ) : error && !visit ? (
          <><h1>Visit unavailable</h1><p className="checkin-description">{error}</p></>
        ) : done ? (
          <>
            <div className="checkin-symbol success"><span>✓</span></div>
            <h1>You&apos;re checked out</h1>
            <p className="checkin-description">Your departure has been recorded. Thank you for visiting {visit?.company_name}.</p>
            <span className="welcome-badge">✓ &nbsp;Checkout complete</span>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`visit-bell ${notifyPermission === "granted" ? "on" : ""}`}
              onClick={enableNotifications}
              disabled={notifyPermission === "granted" || notifyPermission === "denied" || notifyPermission === "unsupported"}
              aria-label={notifyPermission === "granted" ? "Hourly checkout reminders are on" : "Turn on hourly checkout reminders"}
              title={notifyPermission === "denied" ? "Notifications are blocked in your browser settings" : notifyPermission === "granted" ? "Hourly reminders on" : "Turn on hourly reminders"}
            >🔔</button>
            <p className="eyebrow">{(visit?.company_name ?? "").toUpperCase()}</p>
            <h1>Welcome, {visit?.name}</h1>
            <p className="checkin-description">You&apos;re checked in to see <strong>{visit?.host_name}</strong>. Time on site:</p>
            <div className="visit-stopwatch" role="timer" aria-live="off">{formatElapsed(elapsed)}</div>
            {showReminder && (
              <div className="visit-reminder" role="alert">
                <Image src="/tgm-logo.jpg" alt="" width={72} height={23} />
                <span>🔔 You&apos;ve been here {hours} hour{hours === 1 ? "" : "s"}. Remember to check out when you leave.</span>
                <button type="button" className="text-button" onClick={() => setDismissedHour(hours)}>Dismiss</button>
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full-button confirm-checkin" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? <><span className="button-spinner" /> Checking out…</> : "Check out"}
            </button>
            {notifyPermission === "default" && <p className="checkin-description">Tap the bell to get a reminder every hour. Keep this page open.</p>}
          </>
        )}
      </section>
      <p className="checkin-footer">Need help? Please speak with the <strong>reception team</strong>.</p>
    </main>
  );
}

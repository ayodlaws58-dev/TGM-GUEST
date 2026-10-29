"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import {
  addEmployeeHost,
  addEmployeeHostsBulk,
  addGuest,
  approveDemoGuest,
  getReceptionWorkspace,
  getSupabase,
  hasSupabaseConfig,
  listEmployeeHosts,
  listGuests,
  listReceptionHosts,
  listReceptionMembers,
  removeEmployeeHost,
  removeReceptionMember,
  inviteReceptionMember,
  setGuestStatus,
  updateCompanyName,
  VISIT_PURPOSES,
  type EmployeeHost,
  type Guest,
  type GuestStatus,
  type VisitorReportPeriod,
} from "../lib/guests";
import HostSearch from "./components/HostSearch";

type IconName = "grid" | "users" | "chart" | "settings" | "search" | "plus" | "arrow" | "check" | "clock" | "close" | "download" | "logout" | "qr";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" transform="translate(-1 -1) scale(.96)" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v2M14 20h2M20 19v2M19 20h2" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const avatarColors = ["rose", "blue", "amber", "violet", "teal", "orange", "pink"];
const receptionSiteUrl = "https://reception.tgmeducation.net";
const statusLabels: Record<GuestStatus, string> = {
  pending_approval: "Pending approval",
  checked_in: "On site",
  checked_out: "Checked out",
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function accountDisplayName(session: Session | null) {
  const fullName = session?.user.user_metadata.full_name;
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : session?.user.email ?? "Office admin";
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatToday() {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
}

function timeGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatReportRange(period: VisitorReportPeriod) {
  const today = new Date();
  if (period === "daily") return formatToday();
  if (period === "monthly") {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(today);
  }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const formatDay = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  return `${formatDay(start)} - ${formatDay(end)}, ${end.getFullYear()}`;
}

export default function Home() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [greeting, setGreeting] = useState("Good morning");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [accessReady, setAccessReady] = useState(!hasSupabaseConfig);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authCompanyName, setAuthCompanyName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSaving, setAuthSaving] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [receptionToken, setReceptionToken] = useState("");
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState("");
  const [accessRole, setAccessRole] = useState<"admin" | "reception">("admin");
  const [accessError, setAccessError] = useState("");
  const [hostNames, setHostNames] = useState<string[]>([]);
  const [page, setPage] = useState("Overview");
  const [reportPeriod, setReportPeriod] = useState<VisitorReportPeriod>("daily");
  const [reportGuests, setReportGuests] = useState<Guest[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [reportPurpose, setReportPurpose] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [sendingSummary, setSendingSummary] = useState(false);

  useEffect(() => {
    const updateGreeting = () => setGreeting(timeGreeting(new Date()));
    updateGreeting();
    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    const client = getSupabase();
    if (!client) return;
    let active = true;
    let subscription: ReturnType<typeof client.auth.onAuthStateChange>["data"]["subscription"] | undefined;
    void (async () => {
      try {
        const verificationRedirect = new URLSearchParams(window.location.search).get("email_verified") === "1";
        const passwordResetRedirect = new URLSearchParams(window.location.search).get("password_reset") === "1";
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        let nextSession = data.session;
        if (passwordResetRedirect) {
          if (nextSession) setRecovering(true);
          else setAuthError("This password reset link is invalid or has expired. Request a new one.");
          window.history.replaceState(null, "", window.location.pathname);
        }
        if (verificationRedirect) {
          if (nextSession?.user.email_confirmed_at) {
            const { error: signOutError } = await client.auth.signOut({ scope: "local" });
            if (signOutError) throw signOutError;
            nextSession = null;
            setAuthMode("signin");
            setAuthNotice("Your email is verified. Please sign in.");
          } else {
            setAuthNotice("Email verification could not be completed. Please sign in or request a new confirmation email.");
          }
          window.history.replaceState(null, "", window.location.pathname);
        }
        if (!active) return;
        setSession(nextSession);
        setAuthReady(true);
        subscription = client.auth.onAuthStateChange((event, updatedSession) => {
          setSession(updatedSession);
          setAuthError("");
          if (event === "PASSWORD_RECOVERY") setRecovering(true);
          if (event === "SIGNED_OUT") setRecovering(false);
          if (event === "SIGNED_IN") setAuthNotice("");
          if (event === "SIGNED_IN") {
            setAccessReady(false);
            setAccessError("");
            setWorkspaceOwnerId("");
          }
        }).data.subscription;
      } catch (cause) {
        if (active) {
          setAuthError(cause instanceof Error ? cause.message : "Unable to check your sign-in status.");
          setAuthReady(true);
        }
      }
    })();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const refreshGuests = useCallback(async () => {
    setLoading(true);
    try {
      setGuests(await listGuests());
      setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to load today's visitors.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady || (hasSupabaseConfig && !session)) return;
    void refreshGuests();
    getReceptionWorkspace().then(async (workspace) => {
      const hosts = workspace.role === "admin"
        ? (await listEmployeeHosts()).map((host) => host.name)
        : await listReceptionHosts(workspace.reception_token);
      setCompanyName(workspace.company_name);
      setReceptionToken(workspace.reception_token);
      setWorkspaceOwnerId(workspace.owner_id);
      setAccessRole(workspace.role);
      setAccessError("");
      setHostNames(hosts);
      setAccessReady(true);
    }).catch((cause: unknown) => {
      setAccessError(cause instanceof Error ? cause.message : "Unable to load your reception workspace.");
      setAccessReady(true);
    });
  }, [authReady, refreshGuests, session]);

  useEffect(() => {
    if (page !== "Analytics") return;
    let active = true;
    setReportLoading(true);
    listGuests(reportPeriod).then((visitors) => {
      if (active) setReportGuests(visitors);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load the visitor report.");
    }).finally(() => {
      if (active) setReportLoading(false);
    });
    return () => { active = false; };
  }, [guests, page, reportPeriod]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session) return;
    const client = getSupabase();
    if (!client) return;
    const channel = client
      .channel(`guests:${session.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "guests",
        filter: `owner_id=eq.${workspaceOwnerId}`,
      }, () => { void refreshGuests(); })
      .subscribe((status, subscriptionError) => {
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
          setRealtimeError("");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          setRealtimeError(subscriptionError?.message ?? "Unable to connect to live visitor updates.");
        } else if (status === "CLOSED") {
          setRealtimeConnected(false);
        }
      });
    return () => {
      setRealtimeConnected(false);
      void client.removeChannel(channel);
    };
  }, [refreshGuests, session, workspaceOwnerId]);

  const stats = useMemo(() => ({
    total: guests.filter((guest) => guest.status === "checked_in" || guest.status === "checked_out").length,
    onSite: guests.filter((guest) => guest.status === "checked_in").length,
    checkedOut: guests.filter((guest) => guest.status === "checked_out").length,
    pending: guests.filter((guest) => guest.status === "pending_approval").length,
  }), [guests]);

  const purposeFilteredReportGuests = useMemo(
    () => reportGuests.filter((guest) => reportPurpose === "all" || guest.purpose === reportPurpose),
    [reportGuests, reportPurpose],
  );
  const reportPurposes = useMemo(
    () => [...new Set([...VISIT_PURPOSES, ...reportGuests.map((guest) => guest.purpose)])],
    [reportGuests],
  );
  const reportStats = useMemo(() => ({
    total: purposeFilteredReportGuests.filter((guest) => guest.status === "checked_in" || guest.status === "checked_out").length,
    onSite: purposeFilteredReportGuests.filter((guest) => guest.status === "checked_in").length,
    checkedOut: purposeFilteredReportGuests.filter((guest) => guest.status === "checked_out").length,
    selfCheckedOut: purposeFilteredReportGuests.filter((guest) => guest.status === "checked_out" && guest.checkout_method === "self").length,
    assistedCheckedOut: purposeFilteredReportGuests.filter((guest) => guest.status === "checked_out" && guest.checkout_method !== "self").length,
  }), [purposeFilteredReportGuests]);

  const filteredGuests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return guests.filter((guest) => {
      const matchesQuery = !normalizedQuery || [
        guest.name, guest.email ?? "", guest.phone ?? "", guest.company, guest.host_name, guest.purpose,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery && (filter === "all" || guest.status === filter);
    });
  }, [filter, guests, query]);

  const arrivalHours = useMemo(() => {
    const startHour = 8;
    return Array.from({ length: 10 }, (_, index) => {
      const hour = startHour + index;
      return {
        hour,
        label: new Intl.DateTimeFormat("en", { hour: "numeric" }).format(new Date(2020, 0, 1, hour)),
        count: guests.filter((guest) => guest.checked_in_at !== null && new Date(guest.checked_in_at).getHours() === hour).length,
      };
    });
  }, [guests]);
  const maxArrivals = Math.max(3, ...arrivalHours.map((item) => item.count));
  const hostCounts = useMemo(() => {
    const counts = new Map<string, number>();
    purposeFilteredReportGuests.filter((guest) => guest.status === "checked_in" || guest.status === "checked_out")
      .forEach((guest) => counts.set(guest.host_name, (counts.get(guest.host_name) ?? 0) + 1));
    return [...counts.entries()].sort((first, second) => second[1] - first[1]).slice(0, 5);
  }, [purposeFilteredReportGuests]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");
    const fullName = authFullName.trim().replace(/\s+/g, " ");
    const signupCompanyName = authCompanyName.trim().replace(/\s+/g, " ");
    if (authMode === "signup" && !fullName) {
      setAuthError("Enter your full name to create an account.");
      return;
    }
    if (authMode === "signup" && !signupCompanyName) {
      setAuthError("Enter your company name to create an account.");
      return;
    }
    const client = getSupabase();
    if (!client) {
      setAuthError("Authentication is unavailable. Check your Supabase configuration and try again.");
      return;
    }
    setAuthSaving(true);
    if (authMode === "forgot") {
      try {
        const { error: resetError } = await client.auth.resetPasswordForEmail(authEmail.trim(), {
          redirectTo: `${window.location.origin}/?password_reset=1`,
        });
        if (resetError) setAuthError(resetError.message);
        else setAuthNotice("If an account exists for that email, a password reset link is on its way.");
      } catch (cause) {
        setAuthError(cause instanceof Error ? cause.message : "Unable to send the reset email. Please try again.");
      } finally {
        setAuthSaving(false);
      }
      return;
    }
    try {
      const result = authMode === "signup"
        ? await client.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { full_name: fullName, company_name: signupCompanyName },
            emailRedirectTo: `${window.location.origin}/?email_verified=1`,
          },
        })
        : await client.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (result.error) setAuthError(result.error.message);
      else if (authMode === "signup" && !result.data.session) setVerificationPending(true);
      else setSession(result.data.session);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "Unable to authenticate. Please try again.");
    } finally {
      setAuthSaving(false);
    }
  }

  async function handleSetNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    const client = getSupabase();
    if (!client) return;
    setAuthSaving(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) {
        setAuthError(updateError.message);
        return;
      }
      await client.auth.signOut({ scope: "local" });
      setNewPassword("");
      setRecovering(false);
      setSession(null);
      setAuthMode("signin");
      setAuthPassword("");
      setAuthNotice("Your password has been updated. Please sign in.");
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "Unable to update your password. Please try again.");
    } finally {
      setAuthSaving(false);
    }
  }

  async function handleSignOut() {
    const client = getSupabase();
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  async function handleAddVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    // The form now collects a single full name. It is split here so the
    // existing first/middle/last columns keep working until the database
    // is changed to store a full name directly.
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
      setFormError("Enter the visitor's first and last name, phone number, host, and visit purpose.");
      setSaving(false);
      return;
    }
    try {
      await addGuest({
        first_name,
        middle_name,
        last_name,
        email,
        phone,
        company: String(form.get("company") ?? "").trim(),
        host_name,
        purpose,
      }, receptionToken);
      setShowAdd(false);
      setNotice("Visitor request added. It is pending approval and the host will be notified after approval.");
      await refreshGuests();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to add visitor.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(guest: Guest) {
    const nextStatus: GuestStatus = guest.status === "checked_in" ? "checked_out" : "checked_in";
    try {
      await setGuestStatus(guest.id, nextStatus);
      await refreshGuests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update visitor.");
    }
  }

  async function approveVisitor(guest: Guest) {
    setError("");
    setNotice("");
    setApprovingId(guest.id);
    try {
      if (!hasSupabaseConfig) {
        await approveDemoGuest(guest.id);
        setNotice("Visitor approved in demo mode. No email was sent; configure Supabase and Resend for real host notifications.");
      } else {
        const client = getSupabase();
        if (!client) throw new Error("Unable to connect to the workspace.");
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("Sign in again to approve visitors.");
        const response = await fetch(`/api/visitors/${encodeURIComponent(guest.id)}/approve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const result = await response.json() as { error?: string; emailSent?: boolean };
        if (!response.ok) throw new Error(result.error || "Unable to approve visitor.");
        setNotice(result.emailSent
          ? `Visitor approved. An email notification was sent to ${guest.host_name}.`
          : result.error || `Visitor approved, but the notification to ${guest.host_name} is still pending.`);
      }
      await refreshGuests();
    } catch (cause) {
      await refreshGuests();
      setError(cause instanceof Error ? cause.message : "Unable to approve visitor.");
    } finally {
      setApprovingId(null);
    }
  }

  async function sendSummary() {
    setError("");
    setNotice("");
    setSendingSummary(true);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Unable to connect to the workspace.");
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) throw new Error("Sign in again to send the summary.");
      const response = await fetch("/api/daily-summary/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + data.session.access_token },
      });
      const result = await response.json() as { error?: string; to?: string };
      if (!response.ok) throw new Error(result.error || "Unable to send the summary.");
      setNotice(`Today's visitor summary was sent to ${result.to}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the summary.");
    } finally {
      setSendingSummary(false);
    }
  }

  async function saveCompanyName(name: string) {
    await updateCompanyName(name);
    setCompanyName(name);
  }

  function getReceptionBase() {
    return (process.env.NEXT_PUBLIC_SITE_URL || receptionSiteUrl).replace(/\/$/, "");
  }

  // Phones on mobile data can only reach a public HTTPS address, not localhost or a LAN IP.
  function isPrivateHost(base: string) {
    const host = new URL(base).hostname;
    return base.startsWith("http://") || host === "localhost" || host.endsWith(".local")
      || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  }

  function getReceptionUrl() {
    if (!receptionToken) return "";
    return `${getReceptionBase()}/check-in/${receptionToken}`;
  }

  function downloadReceptionQr() {
    const svg = document.querySelector("#reception-qr svg") as SVGSVGElement | null;
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "company-reception-check-in.svg";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  if (!authReady) return <main className="loading-screen"><span className="spinner" />Connecting to your workspace…</main>;

  if (hasSupabaseConfig && recovering && session) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <Image className="auth-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={220} height={69} priority />
          <p className="eyebrow">PASSWORD RESET</p>
          <h1>Set a new password</h1>
          <form className="guest-form" onSubmit={handleSetNewPassword}>
            <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="new-password" minLength={6} required /></label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="primary-button full-button" type="submit" disabled={authSaving}>{authSaving ? <><span className="button-spinner" /> Please wait…</> : "Update password"}</button>
          </form>
        </div>
      </main>
    );
  }

  if (hasSupabaseConfig && !session) {
    if (verificationPending) {
      return (
        <main className="auth-screen">
          <section className="auth-card">
            <Image className="auth-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={220} height={69} priority />
            <p className="eyebrow">EMAIL VERIFICATION</p>
            <h1>Check your email</h1>
            <p className="auth-copy">Thanks, {authFullName.trim().replace(/\s+/g, " ")}. We sent a verification link to <strong>{authEmail}</strong> for <strong>{authCompanyName.trim().replace(/\s+/g, " ")}</strong>. Verify your email to continue; this page will return you to sign in.</p>
            <button className="primary-button full-button" onClick={() => {
              setVerificationPending(false);
              setAuthMode("signin");
              setAuthNotice("After verifying your email, sign in to continue.");
              setAuthError("");
            }}>Return to sign in</button>
          </section>
        </main>
      );
    }
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <Image className="auth-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={220} height={69} priority />
          <p className="eyebrow">TGM CHECK-IN</p>
          <h1>{authMode === "signin" ? "Welcome back" : authMode === "forgot" ? "Reset your password" : "Set up your company"}</h1>
          <p className="auth-copy">{authMode === "forgot" ? "Enter your email and we'll send you a link to choose a new password." : authMode === "signin" ? "Sign in with your company admin or invited reception team account." : "Create a company administrator account. Reception staff should use their email invitation to set a password."}</p>
          <form className="guest-form" onSubmit={handleAuth}>
            {authMode === "signup" && <label>Full name<input type="text" value={authFullName} onChange={(event) => setAuthFullName(event.target.value)} placeholder="e.g. Jordan Taylor" autoComplete="name" maxLength={120} required /></label>}
            {authMode === "signup" && <label>Company name<input type="text" value={authCompanyName} onChange={(event) => setAuthCompanyName(event.target.value)} placeholder="e.g. TGM Marchnata" autoComplete="organization" maxLength={120} required /></label>}
            <label>Email address<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
            {authMode !== "forgot" && <label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>}
            {authMode === "signin" && <button type="button" className="text-button auth-toggle" onClick={() => { setAuthMode("forgot"); setAuthError(""); setAuthNotice(""); }}>Forgot password?</button>}
            {authError && <p className="form-error" role="alert">{authError}</p>}
            {authNotice && <p className="form-success" role="status">{authNotice}</p>}
            <button className="primary-button full-button" type="submit" disabled={authSaving}>{authSaving ? <><span className="button-spinner" /> Please wait…</> : authMode === "signin" ? "Sign in" : authMode === "forgot" ? "Send reset link" : "Create account"}</button>
          </form>
          <button className="text-button auth-toggle" onClick={() => { setAuthMode(authMode === "signup" ? "signin" : authMode === "forgot" ? "signin" : "signup"); setAuthError(""); setAuthNotice(""); }}>
            {authMode === "signin" ? "New to TGM? Set up your company" : authMode === "forgot" ? "Back to sign in" : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    );
  }

  if (hasSupabaseConfig && session && !accessReady) {
    return <main className="loading-screen"><span className="spinner" />Loading your reception access…</main>;
  }

  if (hasSupabaseConfig && session && accessError) {
    return <main className="auth-screen"><section className="auth-card"><Image className="auth-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={220} height={69} priority /><p className="eyebrow">RECEPTION ACCESS</p><h1>Workspace unavailable</h1><p className="auth-copy">{accessError}</p><button className="primary-button full-button" onClick={handleSignOut}>Sign out</button></section></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" aria-label="TGM Check-in home"><Image className="brand-logo" src="/tgm-logo.jpg" alt="TGM Marchnata" width={190} height={60} priority /></a>
        <div className="workspace-select"><span className="workspace-icon">{(companyName || "C")[0].toUpperCase()}</span><span><strong>{companyName || "Your company"}</strong><small>Visitor workspace</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-item ${page === "Overview" ? "active" : ""}`} onClick={() => setPage("Overview")}><Icon name="grid" />Overview</button>
          <button className={`nav-item ${page === "Visitors" ? "active" : ""}`} onClick={() => setPage("Visitors")}><Icon name="users" />Visitors<span className="nav-count">{stats.total}</span></button>
          <button className={`nav-item ${page === "Analytics" ? "active" : ""}`} onClick={() => setPage("Analytics")}><Icon name="chart" />Visitor report</button>
          {accessRole === "admin" && <button className={`nav-item ${page === "Settings" ? "active" : ""}`} onClick={() => setPage("Settings")}><Icon name="settings" />Settings</button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><strong>Need a hand?</strong><p>We&apos;re here to make welcoming visitors a breeze.</p><a href="mailto:hello@tgmcheckin.com">Get in touch <Icon name="arrow" size={14} /></a></div>
          <div className="profile"><div className="profile-avatar">{initials(accountDisplayName(session))}</div><span><strong>{accountDisplayName(session)}</strong><small>{hasSupabaseConfig ? accessRole === "admin" ? "Workspace admin" : "Reception team" : "Reception team"}</small></span>{session && <button className="icon-button profile-logout" aria-label="Sign out" onClick={handleSignOut}><Icon name="logout" /></button>}</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar"><div className="breadcrumb">{companyName || "Company"} <span>/</span> <strong>{page}</strong></div><div className="topbar-right"><span className="today-label">{formatToday()}</span><div className={`live-indicator ${!hasSupabaseConfig ? "demo" : realtimeConnected ? "" : "connecting"}`}><span />{!hasSupabaseConfig ? "Demo mode" : realtimeConnected ? "Live" : "Connecting"}</div></div></header>
        <div className="content">
          {(error || realtimeError) && <div className="error-banner" role="alert"><span>{error || realtimeError}</span><button className="text-button" onClick={() => { setError(""); setRealtimeError(""); }}>Dismiss</button></div>}
          {notice && <div className="success-banner" role="status"><span>{notice}</span><button className="text-button" onClick={() => setNotice("")}>Dismiss</button></div>}

          {page === "Overview" && <>
            <section className="page-heading"><div><p className="eyebrow">RECEPTION OVERVIEW</p><h1>{greeting}</h1><p className="heading-subtitle">Here&apos;s who&apos;s visiting {companyName || "your office"} today.</p>            </div><div className="heading-actions">{hasSupabaseConfig && accessRole === "admin" && <button className="secondary-button" onClick={sendSummary} disabled={sendingSummary}>{sendingSummary ? "Sending…" : "Email today's summary"}</button>}<button className="primary-button" onClick={() => setShowAdd(true)}><Icon name="plus" size={17} /> Add visitor</button></div></section>
            {!hasSupabaseConfig && <div className="demo-note"><span className="demo-note-icon">i</span><span>Demo mode: visitor check-ins are saved in this browser.</span><button onClick={() => setPage("Settings")}>Connect Supabase <Icon name="arrow" size={13} /></button></div>}
            {stats.pending > 0 && <button className="pending-banner" onClick={() => { setPage("Visitors"); setFilter("pending_approval"); }}><span>{stats.pending} visitor{stats.pending === 1 ? "" : "s"} waiting for approval</span><span>Review arrivals <Icon name="arrow" size={14} /></span></button>}
            <section className="reception-banner"><div className="reception-icon"><Icon name="qr" size={22} /></div><div className="reception-info"><span className="event-kicker">YOUR FRONT DESK CHECK-IN</span><h2>One QR for every visitor</h2><p>Display this code at reception. Visitors submit their details for admin approval.</p></div><button className="reception-cta" onClick={() => setShowQr(true)}>Show QR code <Icon name="arrow" size={14} /></button><div className="banner-decoration banner-decoration-one" /><div className="banner-decoration banner-decoration-two" /></section>
            <section className="stats-grid" aria-label="Today's visitor statistics">
              <StatCard label="Visitors today" value={stats.total} caption="Approved visits today" icon="users" color="lavender" trend="Today" />
              <StatCard label="Currently on site" value={stats.onSite} caption="Visitors still in the office" icon="check" color="mint" trend="On site" />
              <StatCard label="Checked out" value={stats.checkedOut} caption="Visits completed today" icon="clock" color="peach" trend="Departed" />
            </section>
            <section className="dashboard-grid">
              <div className="panel arrivals-panel">
                <div className="panel-heading"><div><h2>Today&apos;s arrivals</h2><p>Visitor check-ins by hour</p></div><span className="chart-legend"><i /> Visitors</span></div>
                <div className="chart-wrap"><div className="chart-y-labels"><span>{maxArrivals}</span><span>{Math.round(maxArrivals * .75)}</span><span>{Math.round(maxArrivals * .5)}</span><span>{Math.round(maxArrivals * .25)}</span><span>0</span></div><div className="chart"><div className="chart-grid"><i /><i /><i /><i /><i /></div><div className="chart-bars">{arrivalHours.map((item) => <div key={item.hour} className={`chart-bar ${item.count > 0 ? "highlight" : ""}`} style={{ height: `${Math.max(item.count ? item.count / maxArrivals * 100 : 2, 2)}%` }} title={`${item.count} visitor${item.count === 1 ? "" : "s"} at ${item.label}`} />)}</div><div className="chart-x-labels">{arrivalHours.filter((item) => item.hour % 2 === 0).map((item) => <span key={item.hour}>{item.label}</span>)}</div></div></div>
                <div className="chart-foot"><span><i className="chart-foot-dot" /> Today&apos;s check-ins</span><strong>{stats.total} visitor{stats.total === 1 ? "" : "s"}</strong></div>
              </div>
              <div className="panel checkin-panel"><div className="panel-heading"><div><h2>Who&apos;s in the office</h2><p>Live visitor status</p></div><span className="live-small"><i /> {hasSupabaseConfig ? realtimeConnected ? "Live" : "Connecting" : "Demo"}</span></div><div className="donut-wrap"><div className="donut" style={{ "--progress": `${stats.total ? stats.onSite / stats.total * 100 : 0}%` } as React.CSSProperties}><div className="donut-center"><strong>{stats.onSite}</strong><span>on site now</span></div></div></div><div className="status-legend"><div><span className="legend-name"><i className="legend-checked" />On site</span><strong>{stats.onSite}</strong></div><div><span className="legend-name"><i className="legend-checked-out" />Checked out</span><strong>{stats.checkedOut}</strong></div></div></div>
            </section>
            <GuestTable guests={filteredGuests.slice(0, 5)} loading={loading} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={() => setShowAdd(true)} onStatus={changeStatus} onApprove={approveVisitor} approvingId={approvingId} canNotifyHost={hasSupabaseConfig} onSeeAll={() => setPage("Visitors")} />
          </>}

          {page === "Visitors" && <><section className="page-heading"><div><p className="eyebrow">TODAY&apos;S VISITOR LOG</p><h1>Visitors</h1><p className="heading-subtitle">Review arrivals, approve visitors, and manage who is on site.</p></div><button className="primary-button" onClick={() => setShowAdd(true)}><Icon name="plus" size={17} /> Add visitor</button></section><GuestTable guests={filteredGuests} loading={loading} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} onAdd={() => setShowAdd(true)} onStatus={changeStatus} onApprove={approveVisitor} approvingId={approvingId} canNotifyHost={hasSupabaseConfig} /></>}

          {page === "Analytics" && <>
            <section className="page-heading"><div><p className="eyebrow">{reportPeriod.toUpperCase()} VISITOR REPORT</p><h1>Visitor report</h1><p className="heading-subtitle">Office visitor activity for {formatReportRange(reportPeriod)}.</p></div></section>
            <section className="report-filter-row">
              <label htmlFor="report-period-filter">Report period</label>
              <select id="report-period-filter" className="filter-select" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as VisitorReportPeriod)}>
                <option value="daily">Daily</option><option value="weekly">Weekly (Sunday-Saturday)</option><option value="monthly">Monthly</option>
              </select>
              <label htmlFor="report-purpose-filter">Filter by purpose</label>
              <select id="report-purpose-filter" className="filter-select" value={reportPurpose} onChange={(event) => setReportPurpose(event.target.value)}>
                <option value="all">All purposes</option>
                {reportPurposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
              </select>
            </section>
            <section className="stats-grid">
              <StatCard label="Total visits" value={reportStats.total} caption="Recorded in this period" icon="users" color="lavender" trend={reportPurpose === "all" ? reportPeriod : reportPurpose} />
              <StatCard label="Currently on site" value={reportStats.onSite} caption="Visitors in the office" icon="check" color="mint" trend="On site" />
              <StatCard label="Visits completed" value={reportStats.checkedOut} caption="Checked out in this period" icon="clock" color="peach" trend="Completed" />
            </section>
            <section className="stats-grid">
              <StatCard label="Self checked out" value={reportStats.selfCheckedOut} caption="Visitors who checked themselves out" icon="check" color="mint" trend="Self" />
              <StatCard label="Assisted check-out" value={reportStats.assistedCheckedOut} caption="Checked out by reception staff" icon="users" color="lavender" trend="Assisted" />
              <StatCard label="All check-outs" value={reportStats.checkedOut} caption="Self plus assisted" icon="clock" color="peach" trend="Total" />
            </section>
            <section className="panel guest-panel daily-report-table">
              <div className="guest-panel-heading"><div><div className="title-with-count"><h2>{reportPeriod === "daily" ? "Daily visitors" : reportPeriod === "weekly" ? "Weekly visitors" : "Monthly visitors"}</h2><span className="table-count">{purposeFilteredReportGuests.length}</span></div><p>{reportPurpose === "all" ? `All visitor requests for this ${reportPeriod === "daily" ? "day" : reportPeriod === "weekly" ? "week" : "month"}` : `${reportPurpose} visits for this ${reportPeriod === "daily" ? "day" : reportPeriod === "weekly" ? "week" : "month"}`}</p></div></div>
              <div className="table-scroll"><table>
                <thead><tr><th>VISITOR</th><th>PURPOSE</th><th>VISITING</th><th>COMPANY</th><th>STATUS</th><th>ARRIVAL</th><th>CHECK-OUT</th></tr></thead>
                <tbody>
                  {reportLoading ? <tr><td colSpan={7} className="table-message"><span className="spinner" />Loading saved visitor records…</td></tr>
                    : purposeFilteredReportGuests.length === 0 ? <tr><td colSpan={7} className="table-message">No visitors found for this purpose during this period.</td></tr>
                      : purposeFilteredReportGuests.map((guest, index) => <tr key={guest.id}>
                        <td><div className="guest-cell"><span className={`guest-avatar ${avatarColors[index % avatarColors.length]}`}>{initials(guest.name)}</span><span className="guest-name-cell"><strong>{guest.name}</strong>{guest.email && <small>{guest.email}</small>}{guest.phone && <small>{guest.phone}</small>}</span></div></td>
                        <td>{guest.purpose}</td><td className="company-cell">{guest.host_name}</td><td className="company-cell">{guest.company || "—"}</td>
                        <td><span className={`status-pill ${guest.status}`}><i />{statusLabels[guest.status]}</span></td><td className="arrival-cell">{formatTime(guest.checked_in_at)}</td>
                                                <td className="company-cell">{guest.status === "checked_out" ? `${guest.checkout_method === "self" ? "Self" : "Assisted"} · ${formatTime(guest.checked_out_at)}` : "—"}</td>
                                              </tr>)}
                </tbody>
              </table></div>
              <div className="table-footer"><span>Showing <strong>{purposeFilteredReportGuests.length}</strong> visitor{purposeFilteredReportGuests.length === 1 ? "" : "s"}</span><span>{formatReportRange(reportPeriod)}</span></div>
            </section>
            <section className="panel analytics-table"><div className="panel-heading"><div><h2>Visits by host</h2><p>Employees welcoming visitors in this period</p></div></div><div className="analytics-bars">{hostCounts.length ? hostCounts.map(([host, count]) => <div className="analytics-row" key={host}><span>{host}</span><div className="analytics-track"><i style={{ width: `${reportStats.total ? count / reportStats.total * 100 : 0}%`, background: "#5968de" }} /></div><strong>{count}</strong></div>) : <p className="settings-heading">No visitor activity recorded in this period.</p>}</div></section>
          </>}

          {page === "Settings" && accessRole === "admin" && <SettingsPanel configured={hasSupabaseConfig} companyName={companyName} onShowQr={() => setShowQr(true)} onSaveCompanyName={saveCompanyName} onHostsChanged={async () => { const hosts = await listEmployeeHosts(); setHostNames(hosts.map((host) => host.name)); }} />}
        </div>
      </main>

      {showAdd && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-visitor-title"><div className="modal-heading"><div><p className="eyebrow">RECEPTION</p><h2 id="add-visitor-title">Add a visitor</h2><p>Record a visitor who is arriving at the office.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowAdd(false)}><Icon name="close" /></button></div><form className="guest-form" onSubmit={handleAddVisitor}><label>Full name<input name="full_name" placeholder="e.g. Jordan Taylor Lee" autoComplete="name" required maxLength={240} /></label><label>Email address <span className="optional-label">Optional</span><input name="email" type="email" placeholder="jordan@company.com" autoComplete="email" maxLength={254} /></label><label>Phone number<input name="phone" type="tel" placeholder="e.g. +1 555 123 4567" autoComplete="tel" required maxLength={32} /></label><label>Company <span className="optional-label">Optional</span><input name="company" placeholder="e.g. Acme Inc." autoComplete="organization" maxLength={120} /></label><HostSearch hosts={hostNames} name="host_name" label="Who are they visiting?" /><label>Purpose of visit<select name="purpose" required defaultValue=""><option value="" disabled>Select a purpose</option>{VISIT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving || hostNames.length === 0}>{saving ? <><span className="button-spinner" /> Submitting…</> : <><Icon name="plus" size={16} /> Add for approval</>}</button></div></form></section></div>}

      {showQr && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQr(false); }}><section className="modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title"><div className="modal-heading"><div><p className="eyebrow">RECEPTION CHECK-IN</p><h2 id="qr-title">Your company QR code</h2><p>Display this reusable code at your reception desk.</p></div><button className="icon-button" aria-label="Close" onClick={() => setShowQr(false)}><Icon name="close" /></button></div><div className="qr-code-wrap" id="reception-qr">{receptionToken ? <QRCodeSVG value={getReceptionUrl()} size={220} level="H" includeMargin bgColor="#ffffff" fgColor="#202425" /> : <span className="spinner" />}</div><p className="qr-caption">Visitors scan to enter their details and check in at <strong>{companyName || "your office"}</strong>.</p>{receptionToken && isPrivateHost(getReceptionBase()) && <p className="form-error" role="alert">This code points to {getReceptionBase()}, which only works on this network. To work on Wi-Fi and mobile data, open the dashboard from your public https:// site address (or set NEXT_PUBLIC_SITE_URL) and download the code again.</p>}<button className="primary-button full-button" onClick={downloadReceptionQr} disabled={!receptionToken}><Icon name="download" size={16} /> Download reception QR</button></section></div>}
    </div>
  );
}

function StatCard({ label, value, caption, icon, color, trend }: { label: string; value: string | number; caption: string; icon: IconName; color: string; trend: string }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon name={icon} size={19} /></div><div className="stat-label">{label}</div><div className="stat-value-row"><strong>{value}</strong><span className={`stat-trend ${color === "peach" ? "trend-neutral" : ""}`}>{trend}</span></div><p>{caption}</p></article>;
}

function GuestTable({
  guests,
  loading,
  query,
  setQuery,
  filter,
  setFilter,
  onAdd,
  onStatus,
  onApprove,
  approvingId,
  canNotifyHost,
  onSeeAll,
}: {
  guests: Guest[];
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  onAdd: () => void;
  onStatus: (guest: Guest) => void;
  onApprove: (guest: Guest) => void;
  approvingId: string | null;
  canNotifyHost: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <section className="panel guest-panel">
      <div className="guest-panel-heading"><div><div className="title-with-count"><h2>Today&apos;s visitors</h2><span className="table-count">{guests.length}</span></div><p>Review arrivals and manage visitor status</p></div>{onSeeAll && <button className="text-button see-all" onClick={onSeeAll}>View all visitors <Icon name="arrow" size={14} /></button>}</div>
      <div className="table-toolbar">
        <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search visitors" placeholder="Search visitors..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filter visitors by status" className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All visitors</option><option value="pending_approval">Pending approval</option><option value="checked_in">On site</option><option value="checked_out">Checked out</option>
        </select>
      </div>
      <div className="table-scroll"><table>
        <thead><tr><th>VISITOR</th><th>STATUS</th><th>ARRIVAL</th><th>VISITING</th><th>COMPANY</th><th>PURPOSE</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={7} className="table-message"><span className="spinner" />Loading today&apos;s visitors…</td></tr>
            : guests.length === 0 ? <tr><td colSpan={7} className="table-message"><div className="empty-state"><span className="empty-icon"><Icon name="users" size={21} /></span><strong>No visitors found</strong><span>Try another search or add a visitor to today&apos;s log.</span><button className="primary-button" onClick={onAdd}><Icon name="plus" size={16} /> Add visitor</button></div></td></tr>
              : guests.map((guest, index) => <tr key={guest.id}>
                <td><div className="guest-cell"><span className={`guest-avatar ${avatarColors[index % avatarColors.length]}`}>{initials(guest.name)}</span><span className="guest-name-cell"><strong>{guest.name}</strong>{guest.email && <small>{guest.email}</small>}{guest.phone && <small>{guest.phone}</small>}</span></div></td>
                <td><span className={`status-pill ${guest.status}`}><i />{statusLabels[guest.status]}</span>{guest.status === "checked_in" && guest.host_notified_at && <small className="notification-sent">Host notified</small>}</td>
                <td className="arrival-cell">{formatTime(guest.checked_in_at)}</td><td className="company-cell">{guest.host_name}</td><td className="company-cell">{guest.company || "—"}</td><td className="company-cell" title={guest.purpose}>{guest.purpose}</td>
                <td><div className="row-actions">
                  {guest.status === "pending_approval" && <button className="approve-action" disabled={approvingId === guest.id} onClick={() => onApprove(guest)}>{approvingId === guest.id ? "Sending…" : "Approve & notify"}</button>}
                  {guest.status === "checked_in" && canNotifyHost && !guest.host_notified_at && guest.host_id && <button className="approve-action" disabled={approvingId === guest.id} onClick={() => onApprove(guest)}>{approvingId === guest.id ? "Sending…" : "Retry email"}</button>}
                  {guest.status === "checked_in" && <button className="checkin-action" onClick={() => onStatus(guest)}>Check out</button>}
                  {guest.status === "checked_out" && <button className="checkin-action" onClick={() => onStatus(guest)}>Check in</button>}
                </div></td>
              </tr>)}
        </tbody>
      </table></div>
      <div className="table-footer"><span>Showing <strong>{guests.length}</strong> visitor{guests.length === 1 ? "" : "s"}</span><span>Today Â· {formatToday()}</span></div>
    </section>
  );
}

function SettingsPanel({ configured, companyName, onShowQr, onSaveCompanyName, onHostsChanged }: { configured: boolean; companyName: string; onShowQr: () => void; onSaveCompanyName: (name: string) => Promise<void>; onHostsChanged: () => Promise<void> }) {
  const [companyInput, setCompanyInput] = useState(companyName);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { setCompanyInput(companyName); }, [companyName]);

  async function handleCompanySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = companyInput.trim();
    if (!normalizedName) {
      setSaveError("Enter your company name.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await onSaveCompanyName(normalizedName);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Unable to update the company name.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="page-heading"><div><p className="eyebrow">COMPANY PREFERENCES</p><h1>Settings</h1><p className="heading-subtitle">Manage reception, hosts, and visitor approvals.</p></div></section>
    <section className="panel settings-card">
      <div className="settings-heading"><span className={`settings-status-icon ${configured ? "connected" : ""}`}><Icon name={configured ? "check" : "grid"} size={20} /></span><div><h2>{companyName || "Your company"}</h2><p>{configured ? "Company visitor records sync securely to your Supabase workspace." : "Demo visitor check-ins are saved locally in this browser."}</p></div><span className={`connection-pill ${configured ? "connected" : ""}`}><i />{configured ? "Connected" : "Local demo"}</span></div>
      <div className="settings-divider" />
      <form className="company-name-form guest-form" onSubmit={handleCompanySave}><label>Company name<input value={companyInput} onChange={(event) => setCompanyInput(event.target.value)} maxLength={120} required /></label>{saveError && <p className="form-error" role="alert">{saveError}</p>}<button className="secondary-button" type="submit" disabled={saving || companyInput.trim() === companyName}>{saving ? "Saving…" : "Save company name"}</button></form>
      <div className="settings-divider" />
      <div className="connection-instructions"><h3>Reception QR code</h3><p>Visitors submit their details and select a host. They remain pending until an administrator approves them; approval checks them in and sends an email to the host.</p><button className="primary-button settings-qr-button" onClick={onShowQr}><Icon name="qr" size={16} /> Show reception QR code</button></div>
    </section>
    <ReceptionTeam configured={configured} />
    <EmployeeDirectory configured={configured} onHostsChanged={onHostsChanged} />
    {configured && <Todos />}
    <section className="panel settings-card local-data-card"><div className="settings-heading"><span className="settings-status-icon local"><Icon name="users" size={20} /></span><div><h2>Daily visitor history</h2><p>Visitor log entries keep each office visit separate, including repeat visitors. The overview displays check-ins for today.</p></div></div></section>
  </>;
}

function Todos() {
  const [todos, setTodos] = useState<{ id: string | number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    client.from("todos").select().then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setTodos((data ?? []) as { id: string | number; name: string }[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return <section className="panel settings-card directory-card">
    <div className="settings-heading"><span className="settings-status-icon"><Icon name="check" size={20} /></span><div><h2>Todos</h2><p>Test list loaded from the Supabase todos table.</p></div></div>
    {error && <p className="form-error directory-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading todos…</p> : !error && todos.length === 0 ? <p className="directory-empty">No todos found.</p> : <ul className="host-list">{todos.map((todo) => <li key={todo.id}><span><strong>{todo.name}</strong></span></li>)}</ul>}
  </section>;
}

function ReceptionTeam({ configured }: { configured: boolean }) {
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listReceptionMembers>>>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(configured);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      setMembers(await listReceptionMembers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reception team.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await inviteReceptionMember(email.trim());
      setEmail("");
      setNotice("Invitation sent. The team member can set their password from the email, then sign in here.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to invite reception team member.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(userId: string) {
    setError("");
    try {
      await removeReceptionMember(userId);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove reception access.");
    }
  }

  return <section className="panel settings-card directory-card">
    <div className="settings-heading"><span className="settings-status-icon"><Icon name="users" size={20} /></span><div><h2>Reception team access</h2><p>Invite staff to verify arrivals, approve check-ins, and check visitors out. They cannot change company or employee settings.</p></div></div>
    {!configured
      ? <p className="directory-demo-note">Connect Supabase to invite reception staff. Each team member signs in with their own account.</p>
      : <form className="directory-form team-invite-form guest-form" onSubmit={invite}>
        <label className="team-email-label">Team member email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="reception@company.com" maxLength={254} required /></label>
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Sending invite…" : "Invite reception staff"}</button>
      </form>}
    {error && <p className="form-error directory-error" role="alert">{error}</p>}
    {notice && <p className="form-success directory-error" role="status">{notice}</p>}
    {configured && (loading ? <p className="directory-empty">Loading reception team…</p> : members.length === 0 ? <p className="directory-empty">No reception team members invited yet.</p> : <ul className="host-list">{members.map((member) => <li key={member.user_id}><span><strong>{member.email}</strong><small>Reception staff</small></span><button className="text-button" type="button" onClick={() => void remove(member.user_id)}>Remove access</button></li>)}</ul>)}
  </section>;
}

function EmployeeDirectory({ configured, onHostsChanged }: { configured: boolean; onHostsChanged: () => Promise<void> }) {
  const [hosts, setHosts] = useState<EmployeeHost[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [filter, setFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setHosts(await listEmployeeHosts());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the employee directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function addHost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await addEmployeeHost(name.trim(), email.trim());
      setName("");
      setEmail("");
      await refresh();
      await onHostsChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add employee.");
    } finally {
      setSaving(false);
    }
  }

  async function importHosts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBulkSaving(true);
    setError("");
    setBulkMessage("");
    try {
      const result = await addEmployeeHostsBulk(bulkText);
      if (result.added > 0) {
        await refresh();
        await onHostsChanged();
      }
      const summary = `${result.added} added${result.skipped ? `, ${result.skipped} already in the directory` : ""}.`;
      if (result.errors.length > 0) {
        setError(`${result.added > 0 ? summary + " " : ""}Skipped lines with problems: ${result.errors.slice(0, 5).join(" ")}${result.errors.length > 5 ? ` (+${result.errors.length - 5} more)` : ""}`);
        if (result.added > 0) setBulkText("");
      } else {
        setBulkMessage(summary);
        setBulkText("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to import employees.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function loadBulkFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 512_000) {
      setError("That file is too large. Import up to a few thousand employees at a time.");
      return;
    }
    setBulkText(await file.text());
  }

  async function deactivateHost(host: EmployeeHost) {
    setError("");
    try {
      await removeEmployeeHost(host.id);
      await refresh();
      await onHostsChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove employee.");
    }
  }

  const filterTokens = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleHosts = filterTokens.length === 0
    ? hosts
    : hosts.filter((host) => filterTokens.every((token) => `${host.name} ${host.email}`.toLowerCase().includes(token)));

  return <section className="panel settings-card directory-card">
    <div className="settings-heading"><span className="settings-status-icon"><Icon name="users" size={20} /></span><div><h2>Employee host directory</h2><p>Visitors choose from these names; approvals notify the matching email address.</p></div></div>
    {!configured && <p className="directory-demo-note">Demo addresses are placeholders. Real email is only sent after Supabase and Resend are configured.</p>}
    <form className="directory-form guest-form" onSubmit={addHost}>
      <label>Employee name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jordan Lee" maxLength={120} required /></label>
      <label>Work email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="jordan@company.com" maxLength={254} required /></label>
      <button className="primary-button" type="submit" disabled={saving}>{saving ? "Adding…" : "Add employee"}</button>
    </form>
    <form className="directory-form guest-form bulk-form" onSubmit={importHosts}>
      <label>Add many employees at once<textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={5} placeholder={"One per line: Full name, email\nJordan Lee, jordan@company.com\nAlex Smith, alex@company.com"} /></label>
      <label className="bulk-file">Or upload a CSV file<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => { void loadBulkFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <button className="secondary-button" type="submit" disabled={bulkSaving || !bulkText.trim()}>{bulkSaving ? "Importing…" : "Import employees"}</button>
    </form>
    {bulkMessage && <p className="form-success directory-error" role="status">{bulkMessage}</p>}
    {error && <p className="form-error directory-error" role="alert">{error}</p>}
    {loading ? <p className="directory-empty">Loading employee directory…</p> : hosts.length === 0 ? <p className="directory-empty">No active employees yet. Add a host to enable visitor check-in.</p> : <>
      {hosts.length > 6 && <div className="directory-filter guest-form"><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search employees by name or email" aria-label="Search employees" /><span className="directory-count">{visibleHosts.length} of {hosts.length}</span></div>}
      {visibleHosts.length === 0 ? <p className="directory-empty">No employees match &ldquo;{filter.trim()}&rdquo;.</p> : <ul className="host-list">{visibleHosts.map((host) => <li key={host.id}><span><strong>{host.name}</strong><small>{host.email}</small></span><button className="text-button" type="button" onClick={() => void deactivateHost(host)}>Deactivate</button></li>)}</ul>}
    </>}
  </section>;
}
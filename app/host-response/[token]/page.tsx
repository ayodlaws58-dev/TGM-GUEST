"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getHostResponseVisit,
  HOST_RESPONSE_LABELS,
  submitHostResponse,
  type HostResponse,
  type HostResponseVisit,
} from "../../../lib/guests";

const CHOICES: { value: HostResponse; label: string; hint: string }[] = [
  { value: "coming", label: "Yes, coming now", hint: "Reception will let your visitor know you're on your way." },
  { value: "delayed", label: "Need a few minutes", hint: "Reception will ask your visitor to wait." },
  { value: "unavailable", label: "I can't meet", hint: "Reception will tell your visitor and can rearrange." },
];

function isHostResponse(value: string | null): value is HostResponse {
  return value === "coming" || value === "delayed" || value === "unavailable";
}

export default function HostResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [visit, setVisit] = useState<HostResponseVisit | null>(null);
  const [choice, setChoice] = useState<HostResponse | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    params.then(async ({ token: responseToken }) => {
      setToken(responseToken);
      const details = await getHostResponseVisit(responseToken);
      if (!active) return;
      if (!details) {
        setError("This response link is not valid. Please contact reception.");
        return;
      }
      setVisit(details);
      setNote(details.host_response_note ?? "");
      // The email button preselects an answer; nothing is saved until the host confirms.
      const fromLink = new URLSearchParams(window.location.search).get("answer");
      setChoice(isHostResponse(fromLink) ? fromLink : details.host_response);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load this visit.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [params]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!choice) return;
    setSaving(true);
    setError("");
    try {
      const result = await submitHostResponse(token, choice, note);
      setVisit((current) => current ? { ...current, ...result } : current);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your response. Please contact reception.");
    } finally {
      setSaving(false);
    }
  }

  const active = visit?.status === "checked_in";

  return (
    <main className="checkin-screen">
      <div className="checkin-top-brand"><Image className="checkin-logo" src="/tgm-logo.jpg" alt="TGM" width={200} height={63} priority /></div>
      <section className="checkin-card">
        {loading ? (
          <><h1>One moment</h1><p className="checkin-description">Loading your visitor.</p><span className="spinner" /></>
        ) : !visit ? (
          <><h1>Link unavailable</h1><p className="checkin-description">{error}</p></>
        ) : saved && visit.host_response ? (
          <>
            <div className="checkin-symbol success"><span>✓</span></div>
            <h1>Reception has been told</h1>
            <p className="checkin-description">
              You answered <strong>{HOST_RESPONSE_LABELS[visit.host_response]}</strong> for <strong>{visit.visitor_name}</strong>.
              {visit.host_response_note ? <> Note: “{visit.host_response_note}”</> : null}
            </p>
            <button type="button" className="text-button" onClick={() => setSaved(false)}>Change my answer</button>
          </>
        ) : !active ? (
          <>
            <p className="eyebrow">{visit.company_name.toUpperCase()}</p>
            <h1>Visit has ended</h1>
            <p className="checkin-description">
              <strong>{visit.visitor_name}</strong> is {visit.status === "checked_out" ? "already checked out" : "not checked in yet"}, so no response is needed.
            </p>
          </>
        ) : (
          <form className="host-response-form" onSubmit={handleSubmit}>
            <p className="eyebrow">{visit.company_name.toUpperCase()}</p>
            <h1>Can you meet {visit.visitor_name}?</h1>
            <p className="checkin-description">
              <strong>{visit.visitor_name}</strong>{visit.visitor_company ? <> from <strong>{visit.visitor_company}</strong></> : null} is at reception for <strong>{visit.purpose}</strong>.
            </p>
            {visit.host_response && (
              <p className="host-response-current">Current answer: <strong>{HOST_RESPONSE_LABELS[visit.host_response]}</strong></p>
            )}
            <fieldset className="host-response-choices">
              <legend className="sr-only">Your availability</legend>
              {CHOICES.map((option) => (
                <label key={option.value} className={`host-response-choice ${option.value} ${choice === option.value ? "selected" : ""}`}>
                  <input type="radio" name="answer" value={option.value} checked={choice === option.value} onChange={() => setChoice(option.value)} />
                  <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="host-response-note">
              <span>Note for reception (optional)</span>
              <textarea value={note} maxLength={240} rows={2} placeholder={choice === "unavailable" ? "e.g. Please ask Ada to meet them instead" : "e.g. Down in 10 minutes"} onChange={(event) => setNote(event.target.value)} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full-button" type="submit" disabled={!choice || saving}>
              {saving ? <><span className="button-spinner" /> Sending…</> : "Send to reception"}
            </button>
          </form>
        )}
      </section>
      <p className="checkin-footer">This link is only for the employee being visited. Please don&apos;t forward it.</p>
    </main>
  );
}

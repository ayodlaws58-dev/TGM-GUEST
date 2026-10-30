"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listGuestsInRange, type Guest, type GuestStatus } from "../../lib/guests";
import {
  addDays,
  buildVisitorCsv,
  formatDayLabel,
  formatWatTime,
  watDateKey,
  watDayRange,
} from "../../lib/report-format";

const PAGE_DAYS = 30;

const statusLabels: Record<GuestStatus, string> = {
  pending_approval: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
};

type DaySummary = { key: string; total: number; onSite: number; checkedOut: number; pending: number };

function summarise(guests: Guest[]) {
  return {
    total: guests.length,
    onSite: guests.filter((guest) => guest.status === "checked_in").length,
    checkedOut: guests.filter((guest) => guest.status === "checked_out").length,
    selfCheckedOut: guests.filter((guest) => guest.status === "checked_out" && guest.checkout_method === "self").length,
    pending: guests.filter((guest) => guest.status === "pending_approval").length,
  };
}

function saveCsv(key: string, guests: Guest[]) {
  // The leading BOM makes Excel read names with accents correctly.
  const blob = new Blob(["﻿", buildVisitorCsv(guests)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `visitors-${key}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function loadDay(key: string) {
  const { start, end } = watDayRange(key);
  return listGuestsInRange(start, end);
}

export default function PastReports() {
  const todayKey = watDateKey(new Date());
  const [days, setDays] = useState(PAGE_DAYS);
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Guest[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const start = watDayRange(addDays(todayKey, -(days - 1))).start;
    const end = watDayRange(todayKey).end;
    listGuestsInRange(start, end).then((guests) => {
      if (!active) return;
      const byDay = new Map<string, Guest[]>();
      for (const guest of guests) {
        const key = watDateKey(guest.created_at);
        byDay.set(key, [...(byDay.get(key) ?? []), guest]);
      }
      setSummaries([...byDay.entries()]
        .map(([key, list]) => ({ key, ...summarise(list) }))
        .sort((first, second) => second.key.localeCompare(first.key)));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load past reports.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [days, todayKey]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    loadDay(selected).then((guests) => {
      if (active) setDetail(guests);
    }).catch((cause: unknown) => {
      if (active) setDetailError(cause instanceof Error ? cause.message : "Unable to load this report.");
    }).finally(() => {
      if (active) {
        setDetailLoading(false);
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => { active = false; };
  }, [selected]);

  const download = useCallback(async (key: string) => {
    setDownloading(key);
    try {
      saveCsv(key, key === selected && !detailLoading ? detail : await loadDay(key));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to download this report.");
    } finally {
      setDownloading(null);
    }
  }, [selected, detail, detailLoading]);

  const totals = summarise(detail);

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">DAILY REPORTS</p>
          <h1>Past reports</h1>
          <p className="heading-subtitle">Look back at any earlier day. Days run on West Africa Time, the same as the emailed 5:00 PM summary.</p>
        </div>
      </section>

      <section className="panel past-reports">
        <div className="past-reports-toolbar">
          <label htmlFor="past-report-date">Jump to a date</label>
          <input
            id="past-report-date"
            className="filter-select"
            type="date"
            max={todayKey}
            value={selected ?? ""}
            onChange={(event) => { if (event.target.value) setSelected(event.target.value); }}
          />
          <span className="past-reports-hint">Days with no visitors aren&apos;t listed below.</span>
        </div>

        {error && <p className="form-error past-reports-error" role="alert">{error}</p>}
        {loading ? <p className="table-message"><span className="spinner" />Loading past reports…</p>
          : summaries.length === 0 ? <p className="table-message">No visitors were recorded in the last {days} days.</p>
            : <ul className="day-list">
              {summaries.map((day) => (
                <li key={day.key} className={`day-row ${day.key === selected ? "selected" : ""}`}>
                  <div className="day-date">
                    <strong>{formatDayLabel(day.key)}</strong>
                    {day.key === todayKey && <small>Today · still in progress</small>}
                  </div>
                  <span className="day-stat"><strong>{day.total}</strong> visitor{day.total === 1 ? "" : "s"}</span>
                  <span className="day-stat"><strong>{day.checkedOut}</strong> checked out</span>
                  <span className="day-stat"><strong>{day.onSite}</strong> on site{day.pending > 0 && <> · <strong>{day.pending}</strong> pending</>}</span>
                  <div className="day-actions">
                    <button type="button" className="secondary-button" onClick={() => setSelected(day.key)}>View</button>
                    <button type="button" className="secondary-button" disabled={downloading === day.key} onClick={() => void download(day.key)}>{downloading === day.key ? "Preparing…" : "CSV"}</button>
                  </div>
                </li>
              ))}
            </ul>}
        {!loading && (
          <div className="past-reports-footer">
            <span>Showing the last {days} days</span>
            <button type="button" className="text-button" onClick={() => setDays((current) => current + PAGE_DAYS)}>Load earlier days</button>
          </div>
        )}
      </section>

      {selected && (
        <section className="panel guest-panel past-report-detail" ref={detailRef}>
          <div className="guest-panel-heading">
            <div>
              <div className="title-with-count"><h2>{formatDayLabel(selected)}</h2><span className="table-count">{detail.length}</span></div>
              <p>
                {detailLoading ? "Loading…" : detail.length === 0 ? "No visitors were recorded on this day."
                  : `${totals.checkedOut} checked out (${totals.selfCheckedOut} self, ${totals.checkedOut - totals.selfCheckedOut} assisted) · ${totals.onSite} still on site · ${totals.pending} awaiting approval`}
              </p>
            </div>
            <div className="day-actions">
              <button type="button" className="secondary-button" disabled={detailLoading || detail.length === 0 || downloading === selected} onClick={() => void download(selected)}>Download CSV</button>
              <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          {detailError && <p className="form-error past-reports-error" role="alert">{detailError}</p>}
          <div className="table-scroll"><table>
            <thead><tr><th>VISITOR</th><th>PURPOSE</th><th>VISITING</th><th>COMPANY</th><th>STATUS</th><th>ARRIVAL</th><th>CHECK-OUT</th></tr></thead>
            <tbody>
              {detailLoading ? <tr><td colSpan={7} className="table-message"><span className="spinner" />Loading this report…</td></tr>
                : detail.length === 0 ? <tr><td colSpan={7} className="table-message">No visitors found for this day.</td></tr>
                  : detail.map((guest) => <tr key={guest.id}>
                    <td><span className="guest-name-cell"><strong>{guest.name}</strong>{guest.email && <small>{guest.email}</small>}{guest.phone && <small>{guest.phone}</small>}</span></td>
                    <td>{guest.purpose}</td>
                    <td className="company-cell">{guest.host_name}</td>
                    <td className="company-cell">{guest.company || "—"}</td>
                    <td><span className={`status-pill ${guest.status}`}><i />{statusLabels[guest.status]}</span></td>
                    <td className="arrival-cell">{formatWatTime(guest.checked_in_at)}</td>
                    <td className="company-cell">{guest.status === "checked_out" ? `${guest.checkout_method === "self" ? "Self" : "Assisted"} · ${formatWatTime(guest.checked_out_at)}` : "—"}</td>
                  </tr>)}
            </tbody>
          </table></div>
          <div className="table-footer"><span>Times are shown in West Africa Time.</span><span>{detail.length} visitor{detail.length === 1 ? "" : "s"}</span></div>
        </section>
      )}
    </>
  );
}

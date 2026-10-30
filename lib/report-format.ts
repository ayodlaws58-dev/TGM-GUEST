// Shared by the emailed daily summary (server) and the Past reports page (browser).
// Report days follow West Africa Time (Africa/Lagos): UTC+1 all year, no daylight saving.
export const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportGuest = {
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  host_name: string;
  purpose: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checkout_method?: string | null;
};

const watDateTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
const watTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function formatWat(value: string | null) {
  return value ? watDateTime.format(new Date(value)) : "";
}

export function formatWatTime(value: string | null) {
  return value ? watTime.format(new Date(value)) : "—";
}

function csvCell(value: string | null) {
  let text = value ?? "";
  // Prevent spreadsheet formula injection from visitor-supplied text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildVisitorCsv(guests: ReportGuest[]) {
  const header = ["Name", "Email", "Phone", "Company", "Host", "Purpose", "Status", "Checked in", "Checked out", "Check-out method"];
  const rows = guests.map((guest) => [
    guest.name, guest.email ?? "", guest.phone, guest.company, guest.host_name, guest.purpose,
    guest.status.replace("_", " "), formatWat(guest.checked_in_at), formatWat(guest.checked_out_at),
    guest.status === "checked_out" ? (guest.checkout_method === "self" ? "Self" : "Assisted") : "",
  ].map(csvCell).join(","));
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

/** The report day (YYYY-MM-DD, West Africa Time) that an instant falls on. */
export function watDateKey(value: Date | string) {
  return new Date(new Date(value).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

function parseKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** The UTC instants that bound a report day: start inclusive, end exclusive. */
export function watDayRange(key: string) {
  const { year, month, day } = parseKey(key);
  const startMs = Date.UTC(year, month - 1, day) - WAT_OFFSET_MS;
  return { start: new Date(startMs).toISOString(), end: new Date(startMs + DAY_MS).toISOString() };
}

export function addDays(key: string, days: number) {
  const { year, month, day } = parseKey(key);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatDayLabel(key: string) {
  const { year, month, day } = parseKey(key);
  return dayLabel.format(new Date(Date.UTC(year, month - 1, day)));
}

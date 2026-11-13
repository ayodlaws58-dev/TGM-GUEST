export type SeasonalTheme = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  decoration: string;
  decorations?: string[];
};

export type Season = "christmas" | "easter" | "halloween" | "nigerian-independence" | "default";

export const themes: Record<Season, SeasonalTheme> = {
  christmas: {
    name: "Christmas",
    primary: "#C41E3A",
    secondary: "#0B6623",
    accent: "#FFD700",
    background: "linear-gradient(135deg, #0B6623 0%, #C41E3A 100%)",
    text: "#ffffff", // light text: dark text was unreadable on the green/red gradient
    decoration: "🎄",
    decorations: ["🎄", "🎅", "🎁"],
  },
  easter: {
    name: "Easter",
    primary: "#FFB6D9",
    secondary: "#A0E7E5",
    accent: "#FFE66D",
    background: "linear-gradient(135deg, #FFB6D9 0%, #A0E7E5 100%)",
    text: "#1f2933",
    decoration: "🐰",
  },
  halloween: {
    name: "Halloween",
    primary: "#1a1a1a",
    secondary: "#FF6B35",
    accent: "#9D4EDD",
    // gradient ends in a darker burnt orange so white text stays readable
    background: "linear-gradient(135deg, #1a1a1a 0%, #8a3a12 100%)",
    text: "#ffffff",
    decoration: "🎃",
  },
  "nigerian-independence": {
    name: "Nigerian Independence",
    primary: "#007749",
    secondary: "#FFFFFF",
    accent: "#FF8C00",
    // green / white / green, with a wide white centre so dark text is readable
    background:
      "linear-gradient(90deg, #007749 0%, #007749 15%, #FFFFFF 15%, #FFFFFF 85%, #007749 85%, #007749 100%)",
    text: "#1f2933",
    decoration: "🇳🇬",
  },
  default: {
    name: "Default",
    primary: "#000000",
    secondary: "#ffffff",
    accent: "#f0f0f0",
    background: "#ffffff",
    text: "#1f2933",
    decoration: "✨",
  },
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** Gregorian Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Midnight (local) of the given date, so comparisons are by calendar day. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** True if `today` is within [holiday - daysBefore, holiday + daysAfter]. */
function inWindow(today: Date, holiday: Date, daysBefore: number, daysAfter = 0): boolean {
  const t = startOfDay(today);
  const h = startOfDay(holiday);
  return t >= h - daysBefore * DAY_MS && t <= h + daysAfter * DAY_MS;
}

/* ------------------------------------------------------------------ */
/* Season selection                                                    */
/* ------------------------------------------------------------------ */

type HolidayRule = {
  season: Exclude<Season, "default">;
  date: (year: number) => Date;
  daysBefore: number;
  daysAfter: number;
};

// Order matters if windows ever overlap: the first match wins.
const holidayRules: HolidayRule[] = [
  { season: "christmas", date: (y) => new Date(y, 11, 25), daysBefore: 24, daysAfter: 6 }, // Dec 1 to Dec 31
  { season: "easter", date: easterSunday, daysBefore: 15, daysAfter: 1 },
  { season: "halloween", date: (y) => new Date(y, 9, 31), daysBefore: 7, daysAfter: 0 },
  { season: "nigerian-independence", date: (y) => new Date(y, 9, 1), daysBefore: 7, daysAfter: 0 },
];

/**
 * Pick the season for a given date. Pass a date explicitly to test or to
 * keep server and client in agreement; defaults to now.
 */
export function getCurrentSeason(today: Date = new Date()): Season {
  const year = today.getFullYear();
  for (const rule of holidayRules) {
    if (inWindow(today, rule.date(year), rule.daysBefore, rule.daysAfter)) {
      return rule.season;
    }
  }
  return "default";
}

export function getTheme(season?: Season, today: Date = new Date()): SeasonalTheme {
  return themes[season ?? getCurrentSeason(today)];
}

/** Client-only: sets CSS variables on <html>. Call from useEffect, not during SSR. */
export function applyThemeToDocument(theme: SeasonalTheme, season?: Season) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-secondary", theme.secondary);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-background", theme.background); // use with `background:`, not `background-color:`
  root.style.setProperty("--theme-text", theme.text);
  if (season) root.setAttribute("data-season", season);
}
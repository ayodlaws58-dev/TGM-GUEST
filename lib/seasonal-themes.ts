export type SeasonalTheme = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  decoration: string;
};

export type Season = "christmas" | "easter" | "thanksgiving" | "halloween" | "nigerian-independence" | "default";

export const themes: Record<Season, SeasonalTheme> = {
  christmas: {
    name: "Christmas",
    primary: "#C41E3A",
    secondary: "#0B6623",
    accent: "#FFD700",
    background: "linear-gradient(135deg, #0B6623 0%, #C41E3A 100%)",
    text: "#1f2933",
    decoration: "🎄",
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
  thanksgiving: {
    name: "Thanksgiving",
    primary: "#D2691E",
    secondary: "#FF8C00",
    accent: "#DAA520",
    background: "linear-gradient(135deg, #8B4513 0%, #FF8C00 100%)",
    text: "#ffffff",
    decoration: "🦃",
  },
  halloween: {
    name: "Halloween",
    primary: "#1a1a1a",
    secondary: "#FF6B35",
    accent: "#9D4EDD",
    background: "linear-gradient(135deg, #1a1a1a 0%, #FF6B35 100%)",
    text: "#ffffff",
    decoration: "🎃",
  },
  "nigerian-independence": {
    name: "Nigerian Independence",
    primary: "#007749",
    secondary: "#FFFFFF",
    accent: "#FF8C00",
    background: "linear-gradient(90deg, #007749 33%, #FFFFFF 33%, #FFFFFF 66%, #007749 66%)",
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

export function getCurrentSeason(): Season {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Christmas: Dec 1 - Dec 31
  if (month === 12) return "christmas";

  // Easter: March 22 - April 25 (approximate)
  if ((month === 3 && day >= 22) || (month === 4 && day <= 25)) return "easter";

  // Thanksgiving: November (US - 4th Thursday, but we'll do whole month for simplicity)
  if (month === 11) return "thanksgiving";

  // Halloween: Oct 25 - Oct 31
  if (month === 10 && day >= 25) return "halloween";

  // Nigerian Independence Day: October 1-7
  if (month === 10 && day >= 1 && day <= 7) return "nigerian-independence";

  return "default";
}

export function getTheme(season?: Season): SeasonalTheme {
  const currentSeason = season || getCurrentSeason();
  return themes[currentSeason];
}

export function applyThemeToDocument(theme: SeasonalTheme) {
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-secondary", theme.secondary);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-background", theme.background);
  root.style.setProperty("--theme-text", theme.text);
}

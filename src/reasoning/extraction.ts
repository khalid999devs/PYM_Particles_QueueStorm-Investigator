import { compactWhitespace, uniqueStrings } from "../shared/utils/text";
import { normalizeBanglaDigits, normalizeText } from "./bangla-utils";

export interface TimeHint {
  kind: "hour" | "day_part" | "relative_day";
  value: string;
  hour24?: number;
}

export interface ComplaintFacts {
  originalText: string;
  normalizedText: string;
  amounts: number[];
  phones: string[];
  timeHints: TimeHint[];
  hasCredentialTerms: boolean;
}

const phonePattern = /(?:\+?8801|01)\d{9}\b/g;

const credentialPatterns = [
  /\botp\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /\bcvv\b/i,
  /\bcard number\b/i,
  /ওটিপি/i,
  /পিন/i,
  /পাসওয়ার্ড/i
];

const parseHour = (hourValue: string, meridiem?: string): number | null => {
  const parsed = Number.parseInt(hourValue, 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (!meridiem) {
    return parsed >= 0 && parsed <= 23 ? parsed : null;
  }

  const lowerMeridiem = meridiem.toLowerCase();
  if (lowerMeridiem === "pm" && parsed < 12) {
    return parsed + 12;
  }

  if (lowerMeridiem === "am" && parsed === 12) {
    return 0;
  }

  return parsed >= 0 && parsed <= 23 ? parsed : null;
};

export const normalizePhone = (value: string): string => {
  const digits = normalizeBanglaDigits(value).replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return digits;
  }

  if (digits.startsWith("01")) {
    return `88${digits}`;
  }

  return digits;
};

export const extractAmounts = (text: string): number[] => {
  const normalized = normalizeBanglaDigits(text);
  const withoutPhones = normalized.replace(phonePattern, " ");
  const matches: number[] = [];

  const currencyPatterns = [
    /৳\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g,
    /\b([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:taka|tk|bdt|টাকা)\b/gi
  ];

  for (const pattern of currencyPatterns) {
    for (const match of withoutPhones.matchAll(pattern)) {
      const amount = Number(match[1]?.replace(/,/g, ""));
      if (Number.isFinite(amount) && amount > 0) {
        matches.push(amount);
      }
    }
  }

  for (const match of withoutPhones.matchAll(/(?<![\d+])([0-9]{3,7}(?:\.[0-9]+)?)(?!\d)/g)) {
    const suffix = withoutPhones.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 2);
    if (/am|pm/i.test(suffix)) {
      continue;
    }

    const amount = Number(match[1]?.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      matches.push(amount);
    }
  }

  return [...new Set(matches)];
};

export const extractPhones = (text: string): string[] => {
  const normalized = normalizeBanglaDigits(text);
  const phones = [...normalized.matchAll(phonePattern)].map((match) => normalizePhone(match[0]));
  return uniqueStrings(phones);
};

export const extractTimeHints = (text: string): TimeHint[] => {
  const normalized = normalizeText(text);
  const hints: TimeHint[] = [];

  for (const match of normalized.matchAll(/\b([0-9]{1,2})(?::[0-9]{2})?\s*(am|pm)\b/g)) {
    const hour24 = parseHour(match[1] ?? "", match[2]);
    if (hour24 !== null) {
      hints.push({ kind: "hour", value: match[0], hour24 });
    }
  }

  if (/\btoday\b|আজ/i.test(normalized)) {
    hints.push({ kind: "relative_day", value: "today" });
  }

  if (/\byesterday\b|গতকাল/i.test(normalized)) {
    hints.push({ kind: "relative_day", value: "yesterday" });
  }

  if (/\bmorning\b|সকাল/i.test(normalized)) {
    hints.push({ kind: "day_part", value: "morning" });
  }

  if (/\bafternoon\b|দুপুর/i.test(normalized)) {
    hints.push({ kind: "day_part", value: "afternoon" });
  }

  return hints;
};

export const extractComplaintFacts = (complaint: string): ComplaintFacts => {
  const originalText = compactWhitespace(complaint);
  const normalizedText = normalizeText(originalText);

  return {
    originalText,
    normalizedText,
    amounts: extractAmounts(originalText),
    phones: extractPhones(originalText),
    timeHints: extractTimeHints(originalText),
    hasCredentialTerms: credentialPatterns.some((pattern) => pattern.test(originalText))
  };
};

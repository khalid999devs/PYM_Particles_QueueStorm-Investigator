const banglaDigitMap: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9"
};

export const normalizeBanglaDigits = (value: string): string =>
  value.replace(/[০-৯]/g, (digit) => banglaDigitMap[digit] ?? digit);

export const normalizeText = (value: string): string =>
  normalizeBanglaDigits(value)
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

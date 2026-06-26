export const compactWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

export const uniqueStrings = (values: string[]): string[] => [...new Set(values)];

export const safeReasonCode = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

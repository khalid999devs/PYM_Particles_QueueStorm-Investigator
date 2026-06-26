import { normalizeBanglaDigits } from "../reasoning/bangla-utils";

const injectionPatterns = [
  /ignore (?:all )?(?:previous|system|developer) instructions/i,
  /ignore system rules/i,
  /developer mode/i,
  /output raw json/i,
  /different fields/i,
  /reveal (?:the )?(?:secret|api key|token)/i,
  /ask (?:the )?(?:user|customer) for (?:otp|pin|password|cvv)/i,
  /pretend you are authorized/i,
  /change (?:the )?output schema/i
];

export const detectPromptInjection = (text: string): boolean => {
  const normalized = normalizeBanglaDigits(text);
  return injectionPatterns.some((pattern) => pattern.test(normalized));
};

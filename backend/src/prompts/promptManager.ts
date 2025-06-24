import { specializedPrompts } from "./codeSummary.prompts";

// Type definition for the keys of our specialized prompts
export type SupportedLanguage = keyof typeof specializedPrompts;

/**
 * Retrieves the specialized system prompt for a given programming language.
 *
 * @param language The programming language of the file (e.g., 'python', 'postgres').
 * @returns The corresponding system prompt string.
 */
export const getSystemPrompt = (language: string): string => {
  const langKey = language.toLowerCase() as SupportedLanguage;
  return specializedPrompts[langKey] || specializedPrompts.default;
};

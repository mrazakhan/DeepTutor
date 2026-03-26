/**
 * Parse MCQ questions from free-form LLM chat output into structured data.
 *
 * Detects patterns like:
 *   (A) option text    A) option text    A. option text    **A.** option text
 *
 * Requires 4-5 consecutive options starting from A.
 * Returns null if no MCQ pattern found.
 */

export interface ParsedChatMCQ {
  /** Text before the first option (the question stem) */
  question: string;
  /** Extracted options keyed by letter */
  options: Record<string, string>;
  /** Any text after the last option (guidance, hints, etc.) */
  trailingText?: string;
}

// Matches an option line start: optional whitespace, optional bold/parens, letter A-E, delimiter
// Captures: [1] = letter
const OPTION_RE =
  /^[ \t]*\*{0,2}\(?([A-E])[).:\]]\)?\.?\*{0,2}[ \t]+/gm;

// Same pattern but for inline "(A) ... (B) ... (C) ... (D) ..." on a single line
const INLINE_OPTION_RE =
  /\*{0,2}\(?([A-E])[).:\]]\)?\.?\*{0,2}[ \t]+/g;

/**
 * Try to parse a chat message as an MCQ.
 * Returns structured MCQ data or null if no valid pattern found.
 */
export function parseChatMCQ(text: string): ParsedChatMCQ | null {
  if (!text || text.length < 20) return null;

  // Strategy 1: Options on separate lines
  const lineResult = parseMultiLineMCQ(text);
  if (lineResult) return lineResult;

  // Strategy 2: Options all on one line "(A) x (B) y (C) z (D) w"
  const inlineResult = parseInlineMCQ(text);
  if (inlineResult) return inlineResult;

  return null;
}

function parseMultiLineMCQ(text: string): ParsedChatMCQ | null {
  const matches: { letter: string; index: number; matchEnd: number }[] = [];

  OPTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPTION_RE.exec(text)) !== null) {
    matches.push({
      letter: m[1],
      index: m.index,
      matchEnd: m.index + m[0].length,
    });
  }

  return extractFromMatches(text, matches);
}

function parseInlineMCQ(text: string): ParsedChatMCQ | null {
  // Find lines that contain multiple options inline
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches: { letter: string; index: number; matchEnd: number }[] = [];

    INLINE_OPTION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_OPTION_RE.exec(line)) !== null) {
      matches.push({
        letter: m[1],
        index: m.index,
        matchEnd: m.index + m[0].length,
      });
    }

    // Need at least 4 consecutive options on this line
    const consecutive = findConsecutiveOptions(matches);
    if (consecutive.length >= 4) {
      // The question is everything before this line
      const questionLines = lines.slice(0, i);
      const question = questionLines.join("\n").trim();

      // Parse options from this line
      const options: Record<string, string> = {};
      for (let j = 0; j < consecutive.length; j++) {
        const opt = consecutive[j];
        const start = opt.matchEnd;
        const end =
          j + 1 < consecutive.length
            ? consecutive[j + 1].index
            : line.length;
        options[opt.letter] = line.slice(start, end).trim().replace(/\s+$/, "");
      }

      // Trailing text is everything after this line
      const trailingLines = lines.slice(i + 1);
      const trailingText = trailingLines.join("\n").trim() || undefined;

      if (question) {
        return { question, options, trailingText };
      }
    }
  }

  return null;
}

function extractFromMatches(
  text: string,
  matches: { letter: string; index: number; matchEnd: number }[]
): ParsedChatMCQ | null {
  const consecutive = findConsecutiveOptions(matches);
  if (consecutive.length < 4) return null;

  // Question = everything before first option
  const question = text.slice(0, consecutive[0].index).trim();
  if (!question) return null;

  // Parse each option's text
  const options: Record<string, string> = {};
  for (let i = 0; i < consecutive.length; i++) {
    const start = consecutive[i].matchEnd;
    const end =
      i + 1 < consecutive.length
        ? consecutive[i + 1].index
        : findOptionEnd(text, start);
    options[consecutive[i].letter] = text.slice(start, end).trim();
  }

  // Trailing text = everything after the last option's text
  const lastEnd = findOptionEnd(text, consecutive[consecutive.length - 1].matchEnd);
  const trailingText = text.slice(lastEnd).trim() || undefined;

  return { question, options, trailingText };
}

/**
 * Find the longest consecutive run of option letters starting from A.
 */
function findConsecutiveOptions(
  matches: { letter: string; index: number; matchEnd: number }[]
): typeof matches {
  const expected = "ABCDE";
  const result: typeof matches = [];

  let nextIdx = 0;
  for (const m of matches) {
    if (m.letter === expected[nextIdx]) {
      result.push(m);
      nextIdx++;
      if (nextIdx >= expected.length) break;
    }
  }

  return result;
}

/**
 * Find where an option's text ends.
 * An option ends at the next blank line followed by non-option content,
 * or at end of text.
 */
function findOptionEnd(text: string, start: number): number {
  // Look for a double newline that's followed by something that doesn't look like a continuation
  const rest = text.slice(start);
  const doubleNewline = rest.search(/\n\n(?!\s)/);
  if (doubleNewline !== -1) {
    // Check if what follows looks like a new paragraph (not an option continuation)
    const afterBreak = rest.slice(doubleNewline + 2).trimStart();
    if (afterBreak && !afterBreak.match(/^[A-E][).]/)) {
      return start + doubleNewline;
    }
  }
  return text.length;
}

interface CodeToken {
  text: string;
  color?: string;
}

interface TokenRule {
  pattern: RegExp;
  color?: string;
}

const COMMENT_COLOR = "6B7280";
const STRING_COLOR = "0F766E";
const NUMBER_COLOR = "B45309";
const KEYWORD_COLOR = "1D4ED8";
const IDENTIFIER_COLOR = "7C2D12";
const BUILTIN_COLOR = "7C3AED";
const PROPERTY_COLOR = "0369A1";

const STRING_PATTERN = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y;
const NUMBER_PATTERN = /\b(?:0x[a-fA-F0-9]+|\d+(?:\.\d+)?)\b/y;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$-]*/y;
const WHITESPACE_PATTERN = /\s+/y;

const JS_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
]);

const JS_BUILTINS = new Set([
  "Array",
  "Boolean",
  "console",
  "Date",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Set",
  "String",
]);

const PYTHON_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
]);

const PYTHON_BUILTINS = new Set([
  "dict",
  "enumerate",
  "len",
  "list",
  "print",
  "range",
  "set",
  "str",
]);

const SHELL_KEYWORDS = new Set([
  "case",
  "do",
  "done",
  "echo",
  "elif",
  "else",
  "esac",
  "export",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "local",
  "then",
  "unset",
  "while",
]);

const JSON_RULES: TokenRule[] = [
  { pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/y, color: PROPERTY_COLOR },
  { pattern: STRING_PATTERN, color: STRING_COLOR },
  { pattern: /\b(?:true|false|null)\b/y, color: KEYWORD_COLOR },
  { pattern: NUMBER_PATTERN, color: NUMBER_COLOR },
];

export function tokenizeCodeBlock(
  value: string,
  language: string | null | undefined,
): CodeToken[][] {
  const normalizedLanguage = normalizeLanguage(language);
  const lines = value.split("\n");

  return lines.map((line) => tokenizeLine(line, normalizedLanguage));
}

function normalizeLanguage(language: string | null | undefined): string | null {
  if (!language) {
    return null;
  }

  const normalized = language.toLowerCase();

  if (["js", "jsx", "javascript", "ts", "tsx", "typescript"].includes(normalized)) {
    return "javascript";
  }

  if (["json"].includes(normalized)) {
    return "json";
  }

  if (["bash", "shell", "sh", "zsh"].includes(normalized)) {
    return "shell";
  }

  if (["py", "python"].includes(normalized)) {
    return "python";
  }

  return null;
}

function tokenizeLine(line: string, language: string | null): CodeToken[] {
  if (line.length === 0) {
    return [];
  }

  if (language === "json") {
    return tokenizeWithRules(line, JSON_RULES);
  }

  if (language === "shell") {
    return tokenizeScriptLine(line, "#", SHELL_KEYWORDS);
  }

  if (language === "python") {
    return tokenizeScriptLine(line, "#", PYTHON_KEYWORDS, PYTHON_BUILTINS);
  }

  if (language === "javascript") {
    return tokenizeScriptLine(line, "//", JS_KEYWORDS, JS_BUILTINS);
  }

  return [{ text: line }];
}

function tokenizeWithRules(line: string, rules: TokenRule[]): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    let matched = false;

    for (const rule of rules) {
      rule.pattern.lastIndex = cursor;
      const match = rule.pattern.exec(line);

      if (!match) {
        continue;
      }

      tokens.push({
        text: match[0],
        color: rule.color,
      });
      cursor = rule.pattern.lastIndex;
      matched = true;
      break;
    }

    if (matched) {
      continue;
    }

    tokens.push({ text: line[cursor] ?? "" });
    cursor += 1;
  }

  return coalesceTokens(tokens);
}

function tokenizeScriptLine(
  line: string,
  commentPrefix: string,
  keywords: Set<string>,
  builtins?: Set<string>,
): CodeToken[] {
  const commentStart = findCommentStart(line, commentPrefix);

  if (commentStart === 0) {
    return [{ text: line, color: COMMENT_COLOR }];
  }

  const tokens =
    commentStart === -1
      ? tokenizeScriptSegment(line, keywords, builtins)
      : [
          ...tokenizeScriptSegment(line.slice(0, commentStart), keywords, builtins),
          { text: line.slice(commentStart), color: COMMENT_COLOR },
        ];

  return coalesceTokens(tokens);
}

function tokenizeScriptSegment(
  segment: string,
  keywords: Set<string>,
  builtins?: Set<string>,
): CodeToken[] {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < segment.length) {
    WHITESPACE_PATTERN.lastIndex = cursor;
    const whitespace = WHITESPACE_PATTERN.exec(segment);

    if (whitespace) {
      tokens.push({ text: whitespace[0] });
      cursor = WHITESPACE_PATTERN.lastIndex;
      continue;
    }

    STRING_PATTERN.lastIndex = cursor;
    const stringMatch = STRING_PATTERN.exec(segment);

    if (stringMatch) {
      tokens.push({ text: stringMatch[0], color: STRING_COLOR });
      cursor = STRING_PATTERN.lastIndex;
      continue;
    }

    NUMBER_PATTERN.lastIndex = cursor;
    const numberMatch = NUMBER_PATTERN.exec(segment);

    if (numberMatch) {
      tokens.push({ text: numberMatch[0], color: NUMBER_COLOR });
      cursor = NUMBER_PATTERN.lastIndex;
      continue;
    }

    IDENTIFIER_PATTERN.lastIndex = cursor;
    const identifierMatch = IDENTIFIER_PATTERN.exec(segment);

    if (identifierMatch) {
      const value = identifierMatch[0];
      const nextNonSpace = findNextNonSpace(segment, IDENTIFIER_PATTERN.lastIndex);
      const isCallable = nextNonSpace === "(";
      const isProperty = cursor > 0 && segment[cursor - 1] === ".";

      tokens.push({
        text: value,
        color: isProperty
          ? PROPERTY_COLOR
          : keywords.has(value)
            ? KEYWORD_COLOR
            : builtins?.has(value)
              ? BUILTIN_COLOR
              : isCallable
                ? IDENTIFIER_COLOR
                : undefined,
      });
      cursor = IDENTIFIER_PATTERN.lastIndex;
      continue;
    }

    tokens.push({ text: segment[cursor] ?? "" });
    cursor += 1;
  }

  return tokens;
}

function findCommentStart(line: string, commentPrefix: string): number {
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (line.startsWith(commentPrefix, index)) {
      return index;
    }
  }

  return -1;
}

function findNextNonSpace(value: string, start: number): string | null {
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (!character) {
      continue;
    }

    if (!/\s/.test(character)) {
      return character;
    }
  }

  return null;
}

function coalesceTokens(tokens: CodeToken[]): CodeToken[] {
  const first = tokens[0];

  if (!first) {
    return tokens;
  }

  const merged: CodeToken[] = [first];

  for (let index = 1; index < tokens.length; index += 1) {
    const previous = merged[merged.length - 1];
    const current = tokens[index];

    if (!previous || !current) {
      continue;
    }

    if (previous.color === current.color) {
      previous.text += current.text;
      continue;
    }

    merged.push(current);
  }

  return merged;
}

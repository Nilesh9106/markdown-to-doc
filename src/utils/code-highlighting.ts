import type { Element, RootContent, Text } from "hast";
import { common, createLowlight } from "lowlight";

interface CodeToken {
  text: string;
  color?: string;
  bold?: boolean;
  italics?: boolean;
}

const lowlight = createLowlight(common);

const TOKEN_COLORS: Record<string, string> = {
  addition: "22863A",
  attr: "6F42C1",
  attribute: "005CC5",
  built_in: "6F42C1",
  bullet: "005CC5",
  class: "E36209",
  code: "032F62",
  comment: "6A737D",
  deletion: "B31D28",
  doctag: "D73A49",
  formula: "032F62",
  function: "6F42C1",
  keyword: "D73A49",
  literal: "005CC5",
  meta: "6A737D",
  meta_keyword: "D73A49",
  name: "22863A",
  number: "005CC5",
  operator: "D73A49",
  params: "24292E",
  property: "005CC5",
  punctuation: "24292E",
  quote: "6A737D",
  regexp: "032F62",
  section: "6F42C1",
  selector_attr: "005CC5",
  selector_class: "6F42C1",
  selector_id: "005CC5",
  selector_pseudo: "6F42C1",
  selector_tag: "22863A",
  string: "032F62",
  subst: "24292E",
  symbol: "005CC5",
  tag: "22863A",
  template_tag: "D73A49",
  template_variable: "E36209",
  title: "6F42C1",
  type: "E36209",
  variable: "E36209",
};

const STYLE_CLASSES = {
  emphasis: "italics",
  strong: "bold",
} as const;

export function tokenizeCodeBlock(
  value: string,
  language: string | null | undefined,
): CodeToken[][] {
  const normalizedLanguage = language?.toLowerCase();

  if (!normalizedLanguage || !lowlight.registered(normalizedLanguage)) {
    return splitLines([{ text: value }]);
  }

  try {
    const tree = lowlight.highlight(normalizedLanguage, value);
    return splitLines(flattenTokens(tree.children));
  } catch {
    return splitLines([{ text: value }]);
  }
}

function flattenTokens(
  nodes: RootContent[],
  inheritedColor?: string,
  inheritedStyle?: Pick<CodeToken, "bold" | "italics">,
): CodeToken[] {
  const tokens: CodeToken[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      tokens.push(createToken(node, inheritedColor, inheritedStyle));
      continue;
    }

    if (node.type === "element") {
      tokens.push(
        ...flattenTokens(
          node.children,
          resolveColor(node, inheritedColor),
          resolveStyle(node, inheritedStyle),
        ),
      );
    }
  }

  return coalesceTokens(tokens);
}

function createToken(
  node: Text,
  color?: string,
  style?: Pick<CodeToken, "bold" | "italics">,
): CodeToken {
  return {
    text: node.value,
    color,
    bold: style?.bold,
    italics: style?.italics,
  };
}

function resolveColor(node: Element, inheritedColor?: string): string | undefined {
  const classNames = getClassNames(node);

  for (const className of classNames) {
    const normalized = normalizeClassName(className);

    if (normalized && TOKEN_COLORS[normalized]) {
      return TOKEN_COLORS[normalized];
    }
  }

  return inheritedColor;
}

function resolveStyle(
  node: Element,
  inheritedStyle?: Pick<CodeToken, "bold" | "italics">,
): Pick<CodeToken, "bold" | "italics"> | undefined {
  const classNames = getClassNames(node);
  const nextStyle = {
    bold: inheritedStyle?.bold,
    italics: inheritedStyle?.italics,
  };

  for (const className of classNames) {
    const normalized = normalizeClassName(className);

    if (!normalized) {
      continue;
    }

    if (normalized === STYLE_CLASSES.strong) {
      nextStyle.bold = true;
    }

    if (normalized === STYLE_CLASSES.emphasis) {
      nextStyle.italics = true;
    }
  }

  return nextStyle.bold || nextStyle.italics ? nextStyle : inheritedStyle;
}

function getClassNames(node: Element): string[] {
  const className = node.properties.className;

  if (!Array.isArray(className)) {
    return [];
  }

  return className.flatMap((value) => (typeof value === "string" ? [value] : []));
}

function normalizeClassName(className: string): string | null {
  const normalized = className.replace(/^hljs-/, "").replace(/[.-]/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function splitLines(tokens: CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];

  for (const token of tokens) {
    const segments = token.text.split("\n");

    for (const [index, segment] of segments.entries()) {
      if (segment.length > 0) {
        lines[lines.length - 1]?.push({
          text: segment,
          color: token.color,
          bold: token.bold,
          italics: token.italics,
        });
      }

      if (index < segments.length - 1) {
        lines.push([]);
      }
    }
  }

  return lines;
}

function coalesceTokens(tokens: CodeToken[]): CodeToken[] {
  const merged: CodeToken[] = [];

  for (const token of tokens) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.color === token.color &&
      previous.bold === token.bold &&
      previous.italics === token.italics
    ) {
      previous.text += token.text;
      continue;
    }

    merged.push({ ...token });
  }

  return merged;
}

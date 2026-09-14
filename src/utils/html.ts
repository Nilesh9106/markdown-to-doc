import type { BlockContent, PhrasingContent } from "mdast";

/**
 * Internal phrasing node used for `<u>` / `<ins>`, which has no mdast equivalent.
 */
export interface UnderlineNode {
  type: "htmlUnderline";
  children: PhrasingContent[];
}

type Attrs = Record<string, string>;

type DomNode =
  | { type: "element"; name: string; attrs: Attrs; children: DomNode[] }
  | { type: "text"; value: string }
  | { type: "mdast"; node: PhrasingContent };

type Token =
  | { type: "open"; name: string; attrs: Attrs }
  | { type: "close"; name: string }
  | { type: "void"; name: string; attrs: Attrs }
  | { type: "text"; value: string }
  | { type: "mdast"; node: PhrasingContent };

const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/;
const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const VOID_ELEMENTS = new Set(["br", "hr", "img", "input", "wbr"]);
const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/**
 * Replaces raw inline HTML nodes with their mdast equivalents.
 * Unsupported elements are dropped together with their content.
 */
export function expandInlineHtml(nodes: PhrasingContent[]): PhrasingContent[] {
  if (!nodes.some((node) => node.type === "html")) {
    return nodes;
  }

  const tokens: Token[] = [];

  for (const node of nodes) {
    if (node.type === "html") {
      tokens.push(...tokenize(node.value));
      continue;
    }

    tokens.push({ type: "mdast", node });
  }

  return toPhrasing(buildDom(tokens));
}

/**
 * Converts a raw HTML block into block-level mdast nodes.
 * Unsupported elements are dropped together with their content.
 */
export function expandBlockHtml(html: string): BlockContent[] {
  return toBlocks(buildDom(tokenize(html)));
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let rest = html;

  while (rest.length > 0) {
    const match = TAG_PATTERN.exec(rest);

    if (!match) {
      pushText(tokens, rest);
      break;
    }

    pushText(tokens, rest.slice(0, match.index));

    const name = (match[2] as string).toLowerCase();
    const attrs = parseAttrs(match[3] ?? "");

    if (match[1] === "/") {
      tokens.push({ type: "close", name });
    } else if (match[4] === "/" || VOID_ELEMENTS.has(name)) {
      tokens.push({ type: "void", name, attrs });
    } else {
      tokens.push({ type: "open", name, attrs });
    }

    rest = rest.slice(match.index + match[0].length);
  }

  return tokens;
}

function pushText(tokens: Token[], value: string) {
  if (value.length > 0) {
    tokens.push({ type: "text", value: decodeEntities(value) });
  }
}

function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  ATTR_PATTERN.lastIndex = 0;

  let match = ATTR_PATTERN.exec(source);

  while (match) {
    const value = match[2] ?? "";
    attrs[(match[1] as string).toLowerCase()] = decodeEntities(
      /^["']/.test(value) ? value.slice(1, -1) : value,
    );
    match = ATTR_PATTERN.exec(source);
  }

  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function buildDom(tokens: Token[]): DomNode[] {
  const root: DomNode[] = [];
  const stack: Array<{ name: string; attrs: Attrs; children: DomNode[] }> = [];
  const current = () => stack[stack.length - 1]?.children ?? root;

  for (const token of tokens) {
    if (token.type === "open") {
      stack.push({ name: token.name, attrs: token.attrs, children: [] });
      continue;
    }

    if (token.type === "close") {
      let index = -1;

      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i]?.name === token.name) {
          index = i;
          break;
        }
      }

      if (index === -1) {
        continue;
      }

      const frame = stack[index] as { name: string; attrs: Attrs; children: DomNode[] };
      stack.length = index;
      current().push({
        type: "element",
        name: frame.name,
        attrs: frame.attrs,
        children: frame.children,
      });
      continue;
    }

    if (token.type === "void") {
      current().push({ type: "element", name: token.name, attrs: token.attrs, children: [] });
      continue;
    }

    current().push(token);
  }

  return root;
}

function toPhrasing(nodes: DomNode[]): PhrasingContent[] {
  const children: PhrasingContent[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      children.push({ type: "text", value: node.value });
      continue;
    }

    if (node.type === "mdast") {
      children.push(node.node);
      continue;
    }

    children.push(...elementToPhrasing(node.name, node.attrs, node.children));
  }

  return children;
}

function elementToPhrasing(name: string, attrs: Attrs, children: DomNode[]): PhrasingContent[] {
  switch (name) {
    case "b":
    case "strong":
      return [{ type: "strong", children: toPhrasing(children) }];
    case "i":
    case "em":
      return [{ type: "emphasis", children: toPhrasing(children) }];
    case "s":
    case "del":
    case "strike":
      return [{ type: "delete", children: toPhrasing(children) }];
    case "u":
    case "ins":
      return [
        { type: "htmlUnderline", children: toPhrasing(children) } as unknown as PhrasingContent,
      ];
    case "code":
      return [{ type: "inlineCode", value: textOf(children) }];
    case "br":
      return [{ type: "break" }];
    case "a":
      return attrs.href
        ? [
            {
              type: "link",
              url: attrs.href,
              title: attrs.title ?? null,
              children: toPhrasing(children),
            },
          ]
        : [];
    case "img":
      return attrs.src
        ? [{ type: "image", url: attrs.src, alt: attrs.alt ?? null, title: attrs.title ?? null }]
        : [];
    default:
      return [];
  }
}

function toBlocks(nodes: DomNode[]): BlockContent[] {
  const blocks: BlockContent[] = [];
  let inline: DomNode[] = [];

  const flushInline = () => {
    const children = toPhrasing(inline);
    inline = [];

    if (children.some((child) => child.type !== "text" || child.value.trim() !== "")) {
      blocks.push({ type: "paragraph", children });
    }
  };

  for (const node of nodes) {
    if (node.type === "element" && isBlockElement(node.name)) {
      flushInline();
      blocks.push(...elementToBlocks(node.name, node.children));
      continue;
    }

    inline.push(node);
  }

  flushInline();

  return blocks;
}

function isBlockElement(name: string): boolean {
  return name === "p" || name === "hr" || name === "ul" || name === "ol" || name in HEADINGS;
}

function elementToBlocks(name: string, children: DomNode[]): BlockContent[] {
  if (name === "hr") {
    return [{ type: "thematicBreak" }];
  }

  if (name === "p") {
    return [{ type: "paragraph", children: toPhrasing(children) }];
  }

  const depth = HEADINGS[name];

  if (depth) {
    return [{ type: "heading", depth, children: toPhrasing(children) }];
  }

  const items = children.filter(
    (child): child is Extract<DomNode, { type: "element" }> =>
      child.type === "element" && child.name === "li",
  );

  if (items.length === 0) {
    return [];
  }

  return [
    {
      type: "list",
      ordered: name === "ol",
      spread: false,
      children: items.map((item) => ({
        type: "listItem" as const,
        spread: false,
        children: toBlocks(item.children),
      })),
    },
  ];
}

function textOf(nodes: DomNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value;
      }

      if (node.type === "element") {
        return textOf(node.children);
      }

      return "value" in node.node && typeof node.node.value === "string" ? node.node.value : "";
    })
    .join("");
}

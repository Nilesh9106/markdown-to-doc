import type { Content, PhrasingContent, Root } from "mdast";
import { unified } from "unified";

/**
 * Parses markdown into an MDAST tree with GFM support enabled.
 */
export async function parseMarkdown(markdown: string): Promise<Root> {
  const [{ default: remarkParse }, { default: remarkGfm }] = await Promise.all([
    import("remark-parse"),
    import("remark-gfm"),
  ]);

  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
}

/**
 * Extracts plain text from a markdown node.
 */
export function extractText(node: Content | PhrasingContent): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }

  if ("alt" in node && typeof node.alt === "string") {
    return node.alt;
  }

  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child)).join("");
  }

  return "";
}

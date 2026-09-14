import { describe, expect, it } from "bun:test";
import type { Paragraph, PhrasingContent, Text } from "mdast";
import { expandBlockHtml, expandInlineHtml } from "../utils/html.js";

function text(value: string): Text {
  return { type: "text", value };
}

function typeOf(node: PhrasingContent | undefined): string {
  return node?.type ?? "";
}

function flatten(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if ("value" in node && typeof node.value === "string") {
        return node.value;
      }

      if ("children" in node && Array.isArray(node.children)) {
        return flatten(node.children as PhrasingContent[]);
      }

      return "";
    })
    .join("");
}

describe("expandInlineHtml", () => {
  it("returns the original array when there is no html", () => {
    const nodes: PhrasingContent[] = [text("plain"), { type: "strong", children: [text("bold")] }];

    expect(expandInlineHtml(nodes)).toBe(nodes);
  });

  it("maps formatting tags to their mdast equivalents", () => {
    const cases: Array<[string, string]> = [
      ["<b>x</b>", "strong"],
      ["<strong>x</strong>", "strong"],
      ["<i>x</i>", "emphasis"],
      ["<em>x</em>", "emphasis"],
      ["<s>x</s>", "delete"],
      ["<del>x</del>", "delete"],
      ["<strike>x</strike>", "delete"],
      ["<u>x</u>", "htmlUnderline"],
      ["<ins>x</ins>", "htmlUnderline"],
    ];

    for (const [html, type] of cases) {
      const result = expandInlineHtml([{ type: "html", value: html }]);

      expect(result).toHaveLength(1);
      expect(typeOf(result[0])).toBe(type);
      expect(flatten(result)).toBe("x");
    }
  });

  it("is case insensitive for tag names", () => {
    const result = expandInlineHtml([{ type: "html", value: "<B>loud</B>" }]);

    expect(typeOf(result[0])).toBe("strong");
    expect(flatten(result)).toBe("loud");
  });

  it("wraps markdown siblings that sit between html tags", () => {
    const result = expandInlineHtml([
      { type: "html", value: "<u>" },
      { type: "strong", children: [text("bold")] },
      text(" tail"),
      { type: "html", value: "</u>" },
    ]);

    expect(result).toHaveLength(1);
    expect(typeOf(result[0])).toBe("htmlUnderline");
    expect(flatten(result)).toBe("bold tail");
  });

  it("nests supported tags", () => {
    const result = expandInlineHtml([{ type: "html", value: "<b><i>deep</i></b>" }]);

    expect(typeOf(result[0])).toBe("strong");
    expect(typeOf((result[0] as { children: PhrasingContent[] }).children[0])).toBe("emphasis");
    expect(flatten(result)).toBe("deep");
  });

  it("converts code, br, links and images", () => {
    const result = expandInlineHtml([
      {
        type: "html",
        value:
          '<code>fn()</code><br><a href="https://example.com" title="t">link</a><img src="pic.png" alt="alt text">',
      },
    ]);

    expect(result.map((node) => node.type)).toEqual(["inlineCode", "break", "link", "image"]);
    expect(result[0]).toMatchObject({ value: "fn()" });
    expect(result[2]).toMatchObject({ url: "https://example.com", title: "t" });
    expect(result[3]).toMatchObject({ url: "pic.png", alt: "alt text" });
  });

  it("handles self-closing syntax and single-quoted attributes", () => {
    const result = expandInlineHtml([{ type: "html", value: "<br /><img src='a.png' />" }]);

    expect(result.map((node) => node.type)).toEqual(["break", "image"]);
    expect(result[1]).toMatchObject({ url: "a.png" });
  });

  it("drops anchors without href and images without src", () => {
    const result = expandInlineHtml([{ type: "html", value: "<a>no href</a><img alt='x'>" }]);

    expect(result).toEqual([]);
  });

  it("drops unsupported tags together with their content", () => {
    const result = expandInlineHtml([{ type: "html", value: "<span>hidden</span>" }, text("kept")]);

    expect(flatten(result)).toBe("kept");
  });

  it("drops unclosed and unmatched tags", () => {
    expect(flatten(expandInlineHtml([{ type: "html", value: "<b>never closed" }]))).toBe("");
    expect(flatten(expandInlineHtml([{ type: "html", value: "</b>stray" }]))).toBe("stray");
  });

  it("decodes html entities in text and attributes", () => {
    const result = expandInlineHtml([
      { type: "html", value: '<b>a &amp; b &lt;c&gt;</b><a href="x?a=1&amp;b=2">l</a>' },
    ]);

    expect(flatten([result[0] as PhrasingContent])).toBe("a & b <c>");
    expect(result[1]).toMatchObject({ url: "x?a=1&b=2" });
  });

  it("keeps text that is not part of a tag", () => {
    const result = expandInlineHtml([{ type: "html", value: "before <b>in</b> after" }]);

    expect(flatten(result)).toBe("before in after");
  });
});

describe("expandBlockHtml", () => {
  it("converts paragraphs, headings and horizontal rules", () => {
    const blocks = expandBlockHtml("<h2>Title</h2><p>Body</p><hr>");

    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "thematicBreak"]);
    expect(blocks[0]).toMatchObject({ depth: 2 });
    expect(flatten((blocks[0] as { children: PhrasingContent[] }).children)).toBe("Title");
    expect(flatten((blocks[1] as Paragraph).children)).toBe("Body");
  });

  it("converts every heading level", () => {
    for (let depth = 1; depth <= 6; depth += 1) {
      const blocks = expandBlockHtml(`<h${depth}>H</h${depth}>`);

      expect(blocks[0]).toMatchObject({ type: "heading", depth });
    }
  });

  it("converts unordered and ordered lists", () => {
    const unordered = expandBlockHtml("<ul><li>one</li><li>two</li></ul>");
    const ordered = expandBlockHtml("<ol><li>first</li></ol>");

    expect(unordered[0]).toMatchObject({ type: "list", ordered: false });
    expect((unordered[0] as { children: unknown[] }).children).toHaveLength(2);
    expect(ordered[0]).toMatchObject({ type: "list", ordered: true });
  });

  it("wraps loose inline content in a paragraph", () => {
    const blocks = expandBlockHtml("loose <b>text</b>");

    expect(blocks).toHaveLength(1);
    expect(String(blocks[0]?.type)).toBe("paragraph");
    expect(flatten((blocks[0] as Paragraph).children)).toBe("loose text");
  });

  it("ignores whitespace between block elements", () => {
    const blocks = expandBlockHtml("<p>a</p>\n\n  <p>b</p>\n");

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("drops unsupported block elements and their content", () => {
    const blocks = expandBlockHtml(
      '<script>alert(1)</script><div class="x">hidden</div><p>kept</p>',
    );

    expect(blocks).toHaveLength(1);
    expect(flatten((blocks[0] as Paragraph).children)).toBe("kept");
  });

  it("drops lists that contain no list items", () => {
    expect(expandBlockHtml("<ul></ul>")).toEqual([]);
  });

  it("returns nothing for empty or whitespace-only html", () => {
    expect(expandBlockHtml("")).toEqual([]);
    expect(expandBlockHtml("   \n  ")).toEqual([]);
  });
});

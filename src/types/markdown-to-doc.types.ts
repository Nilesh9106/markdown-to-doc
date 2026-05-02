/**
 * A lightweight style override that can be applied to text content in the
 * header or footer slots.
 */
export interface TextStyle {
  /** Text color in hex format, for example `#2F5D8C`. */
  color?: string;
  /** Font family name used for the text. */
  font?: string;
  /** Font size in points. */
  size?: number;
  /** Renders the text in bold. */
  bold?: boolean;
  /** Renders the text in italics. */
  italics?: boolean;
  /** Underlines the text. */
  underline?: boolean;
}

/**
 * A source description for images used in the cover, header, or footer.
 */
export type ImageSource =
  | { kind: "path"; value: string }
  | { kind: "base64"; value: string }
  | { kind: "buffer"; value: Buffer };

/**
 * Controls the optional cover page that appears before the table of contents
 * and main markdown body.
 */
export interface CoverOptions {
  /** Enables the cover page. Defaults to `false`. */
  show?: boolean;
  /** Alignment used for the main cover text block. Defaults to `center`. */
  alignment?: "left" | "center";
  /** Main title shown prominently on the cover page. */
  title?: string;
  /** Optional subtitle rendered below the title. */
  subtitle?: string;
  /** Optional project or client name. */
  projectName?: string;
  /** Optional date label. The package does not format dates automatically. */
  date?: string;
  /** Optional logo rendered near the top of the cover page. */
  logo?: ImageSource;
  /** Controls horizontal logo placement. Defaults to `top-left`. */
  logoPosition?: "top-left" | "top-center" | "top-right";
  /** Optional larger cover image rendered with the main cover content. */
  image?: ImageSource;
  /** Optional width for the cover image in pixels. */
  imageWidth?: number;
  /** Optional height for the cover image in pixels. */
  imageHeight?: number;
  /** Controls whether the cover image appears above or below the title block. */
  imagePosition?: "aboveTitle" | "belowTitle";
  /**
   * When `true`, the main document header is reused on the cover page.
   * Defaults to `false`.
   */
  showHeader?: boolean;
  /**
   * When `true`, the main document footer is reused on the cover page.
   * Defaults to `false`.
   */
  showFooter?: boolean;
}

/**
 * Controls the optional table of contents section.
 */
export interface TocOptions {
  /** Enables the table of contents. Defaults to `false`. */
  show?: boolean;
  /** Title shown above the generated table of contents. */
  title?: string;
  /**
   * Heading levels to include. Defaults to `[1, 2, 3]`.
   * In DOCX this is rendered as the smallest-to-largest continuous heading range.
   */
  headingLevels?: Array<1 | 2 | 3 | 4>;
  /** Creates clickable TOC entries when supported by the viewer. Defaults to `true`. */
  hyperlinks?: boolean;
}

/**
 * Supported page number formats for header/footer slots.
 */
export type PageNumberFormat = "current" | "currentOfTotal" | "currentSlashTotal";

/**
 * A single left, center, or right slot inside the header or footer.
 */
export type HeaderFooterSlot =
  | { type: "text"; value: string; style?: TextStyle }
  | { type: "image"; source: ImageSource; width?: number; height?: number }
  | { type: "pageNumber"; format?: PageNumberFormat; style?: TextStyle }
  | { type: "link"; text: string; url: string; style?: TextStyle };

/**
 * Shared configuration used by both headers and footers.
 */
export interface HeaderFooterOptions {
  /** Enables the header or footer. Defaults to `false`. */
  show?: boolean;
  /** Content rendered in the left slot. */
  left?: HeaderFooterSlot;
  /** Content rendered in the center slot. */
  center?: HeaderFooterSlot;
  /** Content rendered in the right slot. */
  right?: HeaderFooterSlot;
  /**
   * Adds a divider line. In headers it is rendered below the content.
   * In footers it is rendered above the content. Defaults to `false`.
   */
  borderTop?: boolean;
  /** Divider color in hex format. Defaults to the theme border color. */
  borderColor?: string;
}

/**
 * Global colors used across the generated document.
 */
export interface ThemeColorOptions {
  /** Primary brand color used for key headings and accents. */
  primary?: string;
  /** Secondary accent color used for smaller headings and subtle highlights. */
  secondary?: string;
  /** Default body text color. */
  text?: string;
  /** Muted text color for metadata and footer text. */
  muted?: string;
  /** Border color used for rules, tables, and header/footer dividers. */
  border?: string;
  /** Background color used for code blocks and inline code. */
  codeBg?: string;
  /** Background color used for blockquotes. */
  quoteBg?: string;
  /** Background color used for table header rows. */
  tableHeaderBg?: string;
  /** Background color used for alternating table rows. */
  tableAltBg?: string;
}

/**
 * Global fonts used across the generated document.
 */
export interface ThemeFontOptions {
  /** Default font family used for body text. */
  body?: string;
  /** Font family used for headings. */
  heading?: string;
  /** Monospace font family used for code. */
  mono?: string;
}

/**
 * Font sizes in points.
 */
export interface ThemeFontSizeOptions {
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
  body?: number;
  code?: number;
  headerFooter?: number;
}

/**
 * Spacing values in points except line height, which is a multiplier.
 */
export interface ThemeSpacingOptions {
  /** Body line height multiplier. Defaults to `1.3`. */
  lineHeight?: number;
  /** Space after standard paragraphs. Defaults to `6`. */
  paragraphAfter?: number;
  /** Space before headings by level. */
  headingBefore?: {
    h1?: number;
    h2?: number;
    h3?: number;
    h4?: number;
  };
  /** Space after headings by level. */
  headingAfter?: {
    h1?: number;
    h2?: number;
    h3?: number;
    h4?: number;
  };
  /** Additional spacing used between major sections such as TOC and body. */
  sectionGap?: number;
}

/**
 * Table-specific theme options.
 */
export interface ThemeTableOptions {
  /** Enables alternating row backgrounds. Defaults to `true`. */
  striped?: boolean;
  /** Overrides the table border color. Defaults to the theme border color. */
  borderColor?: string;
  /** Renders header row text in bold. Defaults to `true`. */
  headerBold?: boolean;
}

/**
 * Controls the overall visual appearance of the generated DOCX.
 */
export interface ThemeOptions {
  colors?: ThemeColorOptions;
  fonts?: ThemeFontOptions;
  fontSize?: ThemeFontSizeOptions;
  spacing?: ThemeSpacingOptions;
  tables?: ThemeTableOptions;
}

/**
 * Page size and margin controls.
 */
export interface PageOptions {
  /** Page size. Defaults to `A4`. */
  size?: "A4" | "Letter";
  /** Page orientation. Defaults to `portrait`. */
  orientation?: "portrait" | "landscape";
  /** Margins in inches. */
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

/**
 * Information passed to the image resolver for markdown images.
 */
export interface ImageResolverInput {
  /** Original image source from markdown. */
  src: string;
  /** Markdown image alt text when present. */
  alt?: string;
  /** Markdown image title when present. */
  title?: string;
}

/**
 * Result returned from `resolveImage`.
 */
export interface ResolvedImage {
  /** Binary image data to embed in the DOCX. */
  data: Buffer;
  /** Optional pixel width override. */
  width?: number;
  /** Optional pixel height override. */
  height?: number;
}

/**
 * Asset-related options such as private image resolution.
 */
export interface AssetOptions {
  /**
   * Base directory used to resolve relative markdown image paths.
   * Defaults to `process.cwd()`.
   */
  baseDir?: string;
  /**
   * Optional callback used before the built-in resolver.
   * Use this to fetch private images through your own proxy, signed URL flow,
   * storage SDK, or authentication-aware API.
   */
  resolveImage?: (image: ImageResolverInput) => Promise<ResolvedImage | Buffer | null | undefined>;
  /**
   * Enables built-in `fetch` for public `http` and `https` markdown images.
   * Defaults to `true`.
   */
  fetchRemoteImages?: boolean;
}

/**
 * Full configuration object accepted by {@link markdownToDocx}.
 */
export interface MarkdownToDocxOptions {
  /** Optional cover page configuration. */
  cover?: CoverOptions;
  /** Optional table of contents configuration. */
  toc?: TocOptions;
  /** Optional document header configuration. */
  header?: HeaderFooterOptions;
  /** Optional document footer configuration. */
  footer?: HeaderFooterOptions;
  /** Global page setup. */
  page?: PageOptions;
  /** Global visual theme. */
  theme?: ThemeOptions;
  /** Asset resolution options, including private image hooks. */
  assets?: AssetOptions;
}

/**
 * Normalized options shape used internally after defaults are applied.
 */
export interface ResolvedMarkdownToDocxOptions {
  cover: Omit<Required<CoverOptions>, "logo" | "image" | "imageWidth" | "imageHeight"> & {
    logo?: ImageSource;
    image?: ImageSource;
    imageWidth?: number;
    imageHeight?: number;
  };
  toc: Required<TocOptions>;
  header: Omit<Required<HeaderFooterOptions>, "left" | "center" | "right"> & {
    left?: HeaderFooterSlot;
    center?: HeaderFooterSlot;
    right?: HeaderFooterSlot;
  };
  footer: Omit<Required<HeaderFooterOptions>, "left" | "center" | "right"> & {
    left?: HeaderFooterSlot;
    center?: HeaderFooterSlot;
    right?: HeaderFooterSlot;
  };
  page: Required<PageOptions> & {
    margin: Required<NonNullable<PageOptions["margin"]>>;
  };
  theme: Required<ThemeOptions> & {
    colors: Required<ThemeColorOptions>;
    fonts: Required<ThemeFontOptions>;
    fontSize: Required<ThemeFontSizeOptions>;
    spacing: Required<ThemeSpacingOptions> & {
      headingBefore: Required<NonNullable<NonNullable<ThemeSpacingOptions["headingBefore"]>>>;
      headingAfter: Required<NonNullable<NonNullable<ThemeSpacingOptions["headingAfter"]>>>;
    };
    tables: Required<ThemeTableOptions>;
  };
  assets: Required<AssetOptions>;
}

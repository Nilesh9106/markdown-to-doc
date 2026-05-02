import type {
  MarkdownToDocxOptions,
  ResolvedMarkdownToDocxOptions,
} from "../types/markdown-to-doc.types.js";

const defaultOptions: ResolvedMarkdownToDocxOptions = {
  cover: {
    show: false,
    alignment: "center",
    title: "",
    subtitle: "",
    projectName: "",
    date: "",
    logo: undefined,
    logoPosition: "top-left",
    image: undefined,
    imageWidth: undefined,
    imageHeight: undefined,
    imagePosition: "aboveTitle",
    showHeader: false,
    showFooter: false,
  },
  toc: {
    show: false,
    title: "Table of Contents",
    headingLevels: [1, 2, 3],
    hyperlinks: true,
  },
  header: {
    show: false,
    left: undefined,
    center: undefined,
    right: undefined,
    borderTop: false,
    borderColor: "",
  },
  footer: {
    show: false,
    left: undefined,
    center: undefined,
    right: undefined,
    borderTop: false,
    borderColor: "",
  },
  page: {
    size: "A4",
    orientation: "portrait",
    margin: {
      top: 1,
      bottom: 1,
      left: 0.85,
      right: 0.85,
    },
  },
  theme: {
    colors: {
      primary: "#2F5D8C",
      secondary: "#4C78B5",
      text: "#1F2933",
      muted: "#6B7280",
      border: "#C9D7E3",
      codeBg: "#EEF4F8",
      quoteBg: "#F4F8FB",
      tableHeaderBg: "#2F5D8C",
      tableAltBg: "#F6FAFD",
    },
    fonts: {
      body: "Aptos",
      heading: "Cambria",
      mono: "Consolas",
    },
    fontSize: {
      h1: 22,
      h2: 18,
      h3: 15,
      h4: 13,
      body: 11,
      code: 9,
      headerFooter: 9,
    },
    spacing: {
      lineHeight: 1.3,
      paragraphAfter: 6,
      headingBefore: {
        h1: 18,
        h2: 14,
        h3: 12,
        h4: 10,
      },
      headingAfter: {
        h1: 8,
        h2: 6,
        h3: 4,
        h4: 4,
      },
      sectionGap: 12,
    },
    tables: {
      striped: true,
      borderColor: "#C9D7E3",
      headerBold: true,
    },
  },
  assets: {
    baseDir: process.cwd(),
    resolveImage: async () => undefined,
    fetchRemoteImages: true,
  },
};

/**
 * Applies the package defaults to user-provided options.
 */
export function resolveOptions(options: MarkdownToDocxOptions = {}): ResolvedMarkdownToDocxOptions {
  const theme = {
    ...defaultOptions.theme,
    ...options.theme,
    colors: {
      ...defaultOptions.theme.colors,
      ...options.theme?.colors,
    },
    fonts: {
      ...defaultOptions.theme.fonts,
      ...options.theme?.fonts,
    },
    fontSize: {
      ...defaultOptions.theme.fontSize,
      ...options.theme?.fontSize,
    },
    spacing: {
      ...defaultOptions.theme.spacing,
      ...options.theme?.spacing,
      headingBefore: {
        ...defaultOptions.theme.spacing.headingBefore,
        ...options.theme?.spacing?.headingBefore,
      },
      headingAfter: {
        ...defaultOptions.theme.spacing.headingAfter,
        ...options.theme?.spacing?.headingAfter,
      },
    },
    tables: {
      ...defaultOptions.theme.tables,
      ...options.theme?.tables,
    },
  };

  return {
    cover: {
      ...defaultOptions.cover,
      ...options.cover,
    },
    toc: {
      ...defaultOptions.toc,
      ...options.toc,
    },
    header: {
      ...defaultOptions.header,
      ...options.header,
      borderColor: options.header?.borderColor ?? theme.colors.border,
    },
    footer: {
      ...defaultOptions.footer,
      ...options.footer,
      borderColor: options.footer?.borderColor ?? theme.colors.border,
    },
    page: {
      ...defaultOptions.page,
      ...options.page,
      margin: {
        ...defaultOptions.page.margin,
        ...options.page?.margin,
      },
    },
    theme,
    assets: {
      ...defaultOptions.assets,
      ...options.assets,
    },
  };
}

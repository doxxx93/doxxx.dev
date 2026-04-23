import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "doxxx.dev",
  tagline: "Hi I'm Doxxx, a Cloud Engineer",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://doxxx.dev",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "doxxx93", // Usually your GitHub org/user name.
  projectName: "doxxx.dev", // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "ko",
    locales: ["ko", "en"],
    localeConfigs: {
      ko: {
        label: "한국어",
        htmlLang: "ko",
      },
      en: {
        label: "English",
        htmlLang: "en",
      },
    },
  },

  // Plugins
  plugins: [
    "docusaurus-plugin-sass",
    [
      "@docusaurus/plugin-client-redirects",
      {
        // 삭제된 페이지 리디렉트 (Google 404 해소용, 1~2개월 후 제거 가능)
        redirects: [
          { from: "/docs/intro", to: "/docs/kube" },
        ],
        createRedirects(existingPath) {
          const redirects: string[] = [];

          // 삭제된 태그 → /tags (태그 변경/삭제 시 여기에 추가)
          const deletedTags = [
            "containerd", "dynamodb", "summarization", "calico",
            "textract", "namespace", "chroot", "medical-paper",
            "lambda", "retrospect", "컴퓨터-구조",
          ];

          // 삭제된 docs 페이지 → 대체 경로
          const deletedDocs: Record<string, string> = {
            "/docs/intro": "/docs/kube",
          };

          const isDefaultLocale = !existingPath.startsWith("/en/");
          const isEnLocale = existingPath.startsWith("/en/");

          // /blog/... → /... 리다이렉트 (routeBasePath 변경 대응)
          if (!existingPath.startsWith("/docs") && !existingPath.startsWith("/blog")) {
            redirects.push(`/blog${existingPath}`);
            if (isEnLocale) {
              const pathWithoutLocale = existingPath.slice(3);
              redirects.push(`/en/blog${pathWithoutLocale}`);
            }
          }

          // 삭제된 태그 리디렉트
          if (existingPath === "/tags" || existingPath === "/en/tags") {
            const prefix = isEnLocale ? "/en" : "";
            redirects.push(...deletedTags.map((t) => `${prefix}/tags/${t}`));
          }

          // 삭제된 docs 리디렉트 (en locale)
          for (const [from, to] of Object.entries(deletedDocs)) {
            if (existingPath === `/en${to}`) {
              redirects.push(`/en${from}`);
            }
          }

          return redirects.length > 0 ? redirects : undefined;
        },
      },
    ],
  ],
  future: {
    faster: true,
    v4: true,
  },
  // mermaid configuration
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  themes: ["@docusaurus/theme-mermaid"],

  stylesheets: [],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          showLastUpdateTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/doxxx93/doxxx.dev/edit/master/",
        },
        blog: {
          routeBasePath: "/", // 블로그를 메인 페이지로
          blogTitle: "doxxx.dev",
          blogDescription:
            "Writing about Kubernetes, Cloud, and Rust",
          blogSidebarTitle: "All Posts",
          blogSidebarCount: "ALL",
          showReadingTime: true,
          editLocalizedFiles: true,
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
            copyright: `Copyright ${new Date().getFullYear()} Doxxx`,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/doxxx93/doxxx.dev/edit/master/",
          // Useful options to enforce blogging best practices
          // onInlineTags: 'warn',
          // onInlineAuthors: 'warn',
          // onUntruncatedBlogPosts: 'warn',
        },
        ...(process.env.NODE_ENV === "production" && {
          gtag: {
            trackingID: "G-6Z46YSGF2C",
            anonymizeIP: true,
          },
        }),
        theme: {
          customCss: "./src/css/custom.scss",
        },
      } satisfies Preset.Options,
    ],
  ],

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preload',
        href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
        as: 'style',
        onload: "this.onload=null;this.rel='stylesheet'",
      },
    },
    {
      tagName: 'noscript',
      attributes: {},
      innerHTML: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />',
    },
    {
      tagName: 'script',
      attributes: {type: 'application/ld+json'},
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: 'https://doxxx.dev',
        name: 'doxxx.dev',
        author: {
          '@type': 'Person',
          name: 'Doyul Kim',
          url: 'https://doxxx.dev/about',
          sameAs: ['https://github.com/doxxx93', 'https://linkedin.com/in/doxxx'],
        },
      }),
    },
  ],

  themeConfig: {
    // SEO 글로벌 메타데이터
    metadata: [
      {name: "author", content: "Doxxx"},
    ],
    image: "img/og-image.jpg",
    navbar: {
      title: "doxxx.dev",
      logo: {
        alt: "Doxxx profile logo",
        src: "img/logo.webp",
      },
      items: [
        {
          type: "dropdown",
          label: "Docs",
          position: "left",
          items: [
            {
              type: "docSidebar",
              sidebarId: "kubeSidebar",
              label: "kube",
            },
          ],
        },
        {to: "/archive", label: "Archive", position: "left"},
        {to: "/about", label: "About", position: "left"},
        {
          type: "localeDropdown",
          position: "right",
        },
        {
          "aria-label": "GitHub Repository",
          className: "navbar--github-link",
          href: "https://github.com/doxxx93",
          position: "right",
        },
      ],
    },
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()}  Doxxx, All Rights Reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: [
        "java",
        "bash",
        "json",
        "toml",
        "yaml",
        "swift",
        "rust",
      ],
    },
    algolia: {
      appId: "YFSTKU4HVZ",
      apiKey: "08f8e70633947cfb337e5a3a481ccfff",
      indexName: "doxxxdev",
      contextualSearch: true,
      searchParameters: {
        attributesToHighlight: ["hierarchy.lvl0", "hierarchy.lvl1", "hierarchy.lvl2", "content"],
        attributesToSnippet: ["content:30"],
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

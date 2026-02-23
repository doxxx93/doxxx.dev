import {themes as prismThemes} from "prism-react-renderer";
import type {Config} from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const config: Config = {
  title: "Doxxx Dev",
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
        createRedirects(existingPath) {
          // /blog/... → /... 리다이렉트 (구글 인덱싱된 옛 URL 지원)
          if (!existingPath.startsWith("/docs") && !existingPath.startsWith("/blog")) {
            return [`/blog${existingPath}`];
          }
          return undefined;
        },
      },
    ],
    [
      "@docusaurus/plugin-pwa",
      {
        offlineModeActivationStrategies: ['appInstalled', 'standalone', 'queryString'],
        pwaHead: [
          {
            tagName: 'link',
            rel: 'manifest',
            href: '/manifest.json',
          },
          {
            tagName: 'meta',
            name: 'theme-color',
            media: '(prefers-color-scheme: light)',
            content: '#ffffff',
          },
          {
            tagName: 'meta',
            name: 'theme-color',
            media: '(prefers-color-scheme: dark)',
            content: '#000000',
          },
        ],
      },
    ],
  ],
  future: {
    experimental_faster: true,
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

  stylesheets: [
    // Pretendard (Korean web font)
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
    // KaTeX
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.16.32/dist/katex.min.css",
      type: "text/css",
      integrity:
        "sha384-8K5tjYRcv7hr4uuSd0QJJchz//nSR63itKQtnYvhozplQjQG85jQyfkH1YIMAkUv",
      crossorigin: "anonymous",
    },
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/doxxx93/doxxx.dev/edit/master/",
        },
        blog: {
          routeBasePath: "/", // 블로그를 메인 페이지로
          blogTitle: "Doxxx Dev",
          blogDescription:
            "I am a cloud engineer.",
          blogSidebarTitle: "All Posts",
          blogSidebarCount: "ALL",
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
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
        gtag: {
          trackingID: "G-S7SC61596T",
          anonymizeIP: true,
        },
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
        rel: 'preconnect',
        href: 'https://cdn.jsdelivr.net',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'script',
      attributes: {type: 'application/ld+json'},
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: 'https://doxxx.dev',
        name: 'Doxxx Dev',
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
      title: "Doxxx Dev",
      logo: {
        alt: "Doxxx profile logo",
        src: "img/logo.png",
      },
      items: [
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
      ],
    },
    algolia: {
      appId: "YFSTKU4HVZ",
      apiKey: "08f8e70633947cfb337e5a3a481ccfff",
      indexName: "doxxxdev",
      contextualSearch: false,
      searchParameters: {
        attributesToHighlight: ["hierarchy.lvl0", "hierarchy.lvl1", "hierarchy.lvl2", "content"],
        attributesToSnippet: ["content:30"],
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

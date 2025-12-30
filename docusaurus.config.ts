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
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "ko",
    locales: ["ko"],
  },

  // Plugins
  plugins: ["docusaurus-plugin-sass"],
  future: {
    experimental_faster: true,
  },
  // mermaid configuration
  markdown: {
    mermaid: true,
  },
  themes: ["@docusaurus/theme-mermaid"],

  // katex stylesheets
  stylesheets: [
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css",
      type: "text/css",
      integrity:
        "sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM",
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
          editUrl: "https://github.com/doxxx93.github.io/blob/master/",
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
          // feedOptions: {
          //   type: ['rss', 'atom'],
          //   xslt: true,
          // },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/doxxx93.github.io/blob/master/",
          // Useful options to enforce blogging best practices
          // onInlineTags: 'warn',
          // onInlineAuthors: 'warn',
          // onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: "./src/css/custom.scss",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image:
      "https://avatars.githubusercontent.com/u/51396905?s=400&u=65840fab9273e12e5b3521af740027adfa28ef62&v=4",
    navbar: {
      title: "Doxxx Dev",
      logo: {
        alt: "Doxxx profile logo",
        src: "img/logo.svg",
      },
      items: [
        {to: "/archive", label: "Archive", position: "left"},
        {to: "/about", label: "About", position: "left"},
        // {
        //   href: 'https://github.com/doxxx93/doxxx93',
        //   label: 'GitHub',
        //   position: 'right',
        // },
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
        "sql",
        "toml",
        "docker",
        "yaml",
        "swift",
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

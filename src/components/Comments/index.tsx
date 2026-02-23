import React from "react";
import Giscus from "@giscus/react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function Comments(): JSX.Element {
  const {i18n} = useDocusaurusContext();
  const lang = i18n.currentLocale === "en" ? "en" : "ko";

  return (
    <div>
      <Giscus
        id="comments"
        repo="doxxx93/doxxx.dev"
        repoId="R_kgDOM8mMuQ"
        category="Comments"
        categoryId="DIC_kwDOM8mMuc4CjM3m"
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme="preferred_color_scheme"
        lang={lang}
        loading="eager"
      />
    </div>
  );
}

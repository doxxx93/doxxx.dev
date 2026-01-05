import React from "react";
import Giscus from "@giscus/react";

export default function Comments(): JSX.Element {
  return (
    <div>
      <Giscus
        id="comments"
        repo="doxxx93/doxxx.dev"
        repoId="R_kgDOM8mMuQ"
        category="Comments"
        categoryId="DIC_kwDOM8mMuc4CjM3m"
        mapping="pathname"
        strict="1"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme="preferred_color_scheme"
        lang="ko"
        loading="lazy"
      />
    </div>
  );
}

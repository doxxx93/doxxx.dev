import React from "react";
import Giscus from "@giscus/react";
import { useColorMode } from "@docusaurus/theme-common";

export default function Comments(): JSX.Element {
  const { colorMode } = useColorMode();

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
        theme={colorMode === "dark" ? "dark_tritanopia" : "light_tritanopia"}
      />
    </div>
  );
}

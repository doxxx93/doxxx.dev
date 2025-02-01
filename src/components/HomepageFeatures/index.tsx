import React, {useState, useEffect, useCallback} from "react";
import {PrismAsyncLight as SyntaxHighlighter} from "react-syntax-highlighter";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import {useColorMode} from "@docusaurus/theme-common";
import styles from "./index.module.scss";

SyntaxHighlighter.registerLanguage("java", java);

const actions = ["code()", "create()", "innovate()", "develop()", "design()"];

const HomepageFeatures: React.FC = () => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const {colorMode} = useColorMode();

  const typeAction = useCallback(() => {
    const currentAction = actions[currentActionIndex];
    if (isTyping) {
      if (displayedText.length < currentAction.length) {
        setDisplayedText(currentAction.slice(0, displayedText.length + 1));
      } else {
        setIsTyping(false);
        setTimeout(() => setIsTyping(true), 1000);
      }
    } else {
      if (displayedText.length > 0) {
        setDisplayedText(displayedText.slice(0, -1));
      } else {
        setCurrentActionIndex((prevIndex) => (prevIndex + 1) % actions.length);
        setIsTyping(true);
      }
    }
  }, [currentActionIndex, displayedText, isTyping]);

  useEffect(() => {
    const timer = setTimeout(typeAction, isTyping ? 100 : 50);
    return () => clearTimeout(timer);
  }, [typeAction, isTyping]);

  const codeString = `
public class Doxxx implements SoftwareEngineer {
    public CompletableFuture<Awesome> do() {
        return ${displayedText}
    }
}
`.trim();

  const darculaTheme = {
    'code[class*="language-"]': {color: "#a9b7c6"},
    keyword: {color: "#cc7832"},
    boolean: {color: "#cc7832"},
    function: {color: "#ffc66d"},
    number: {color: "#6897bb"},
    string: {color: "#6a8759"},
    comment: {color: "#808080"},
    "class-name": {color: "#a9b7c6"},
  };

  return (
    <div className={styles.container}>
      <div className={styles.editor}>
        <div className={styles.editorHeader}>
          <div className={styles.windowControls}>
            <span className={styles.closeButton}></span>
            <span className={styles.minimizeButton}></span>
            <span className={styles.maximizeButton}></span>
          </div>
          <span className={styles.fileTab}>doxxx.dev</span>
        </div>
        <SyntaxHighlighter
          language="java"
          style={darculaTheme}
          customStyle={{
            margin: 0,
            padding: "20px",
            fontSize: "14px",
            lineHeight: "1.5",
            backgroundColor:
              colorMode === "dark" ? "#2b2b2b" : "#fafafa",
          }}
          showLineNumbers
          lineNumberStyle={{
            minWidth: "1em",
            paddingRight: "1em",
            textAlign: "right",
            color: "#606366",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default HomepageFeatures;

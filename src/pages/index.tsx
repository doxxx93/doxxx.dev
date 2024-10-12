import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.scss';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
      </div>
    </header>
  );
}

const codeSnippets = [
  `const developer = "doxxx";
  const traits = ["창의적", "열정적", "혁신적"];
  const skills = ["웹 개발", "머신러닝", "데이터 분석"];
  const goals = "세상을 변화시키는 코드 작성";`,
  `function createImpact() {
    const idea = generateIdea();
    const project = developProject(idea);
    return launchProject(project);
  }`,
  `while (true) {
    learn();
    code();
    innovate();
  }`
];

function CodeBlock() {
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentSnippet((prev) => (prev + 1) % codeSnippets.length);
        setIsVisible(true);
      }, 500);
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className={styles.codeBlockWrapper}>
      <pre className={styles.codeBlock}>
        <code>
          do &#123;<br/>
          <span className={clsx({[styles.fadeIn]: isVisible, [styles.fadeOut]: !isVisible})}>
            {codeSnippets[currentSnippet].split('\n').map((line, index) => (
              <React.Fragment key={index}>
                &nbsp;&nbsp;{line}<br />
              </React.Fragment>
            ))}
          </span>
          &#125; while (pursuing(dreams));
        </code>
      </pre>
    </div>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main className={styles.main}>
        <CodeBlock />
      </main>
    </Layout>
  );
}

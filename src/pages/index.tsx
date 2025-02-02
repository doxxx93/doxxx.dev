import React from "react";
import Layout from "@theme/Layout";
import styles from "./index.module.scss";
import { SiGithub, SiAmazonwebservices, SiKubernetes, SiLinux } from "react-icons/si"; // react-icons 사용

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <div className="container">
        <div className={styles.content}>
          <div className={styles.textContent}>
            <h1>Cloud Engineer</h1>
            <p>AWS • Kubernetes • DevOps</p>
            <div className={styles.links}>
              {/* GitHub 아이콘 */}
              <a href="https://github.com/doxxx93" className={styles.githubLink}>
                <SiGithub size={24} title="GitHub" /> GitHub
              </a>
            </div>
          </div>

          <div className={styles.techIcons}>
            {/* AWS 아이콘 */}
            <SiAmazonwebservices size={24} title="AWS" />
            {/* Kubernetes 아이콘 */}
            <SiKubernetes size={24} title="Kubernetes" />
            {/* Infrastructure 관련 아이콘 */}
            <SiLinux size={24} title="Infrastructure" />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout>
      <HomepageHeader />
      <main className={styles.main}>
        <div className="container"></div>
      </main>
    </Layout>
  );
}

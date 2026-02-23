import React from "react";
import Layout from "@theme/Layout";
import styles from "./about.module.scss";

export default function About(): React.JSX.Element {
  return (
    <Layout title="About">
      <main style={{ padding: "2rem 0" }}>
        <div className={`about-content ${styles.container}`}>
          <h1 className={styles.title}>About</h1>

          <section className={styles.profile}>
            <img
              src="https://avatars.githubusercontent.com/u/51396905?s=400&u=65840fab9273e12e5b3521af740027adfa28ef62&v=4"
              alt="Doyul Kim"
              className={styles.avatar}
            />
            <div>
              <h2 className={styles.name}>Doyul (Ian) Kim</h2>
              <p className={styles.role}>Software Engineer · Kubernetes & Rust</p>
              <p className={styles.company}>STCLab, Inc. · Seoul, South Korea</p>
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.text}>
              Developing a Kubernetes workload cost-optimization platform in Rust.
            </p>
            <p className={styles.text}>
              At STCLab, I design and implement core features — alerting, autoscaling,
              resource optimization, and cost analysis — for Kubernetes workloads.
              Built the team's cloud infrastructure (EKS, ROSA) from scratch with Terraform.
            </p>
            <p className={styles.text}>
              Member of <a href="https://github.com/kube-rs/kube">kube-rs</a>,
              a production-grade open-source Kubernetes client for Rust.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Skills</h2>
            <p className={styles.textCompact}>
              <strong>Languages:</strong> Rust, TypeScript, Java, Python
            </p>
            <p className={styles.textCompact}>
              <strong>Infrastructure:</strong> Kubernetes (EKS, ROSA), Terraform, Docker, ArgoCD, Helm, Karpenter, Istio
            </p>
            <p className={styles.textCompact}>
              <strong>Observability:</strong> Prometheus, Grafana, Fluent Bit, Loki, k6
            </p>
            <p className={styles.text}>
              <strong>Data:</strong> DuckDB, Polars, MySQL
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Certifications</h2>
            <ul className={styles.list}>
              <li>AWS Certified Solutions Architect – Associate (2024)</li>
              <li>AWS Public Sector GameDay — Third Place (2024)</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Education</h2>
            <p className={styles.text}>
              <strong>Konkuk University</strong>
              <br />
              Bachelor's Degree, Industrial Engineering (2021)
            </p>
          </section>

          <section>
            <h2 className={styles.sectionHeading}>Links</h2>
            <ul className={styles.links}>
              <li><a href="https://github.com/doxxx93">GitHub</a></li>
              <li><a href="https://linkedin.com/in/doxxx">LinkedIn</a></li>
              <li><a href="mailto:me@doxxx.dev">me@doxxx.dev</a></li>
            </ul>
          </section>
        </div>
      </main>
    </Layout>
  );
}

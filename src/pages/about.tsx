import React from "react";
import Layout from "@theme/Layout";

const sectionStyle: React.CSSProperties = {
  marginBottom: "2.5rem",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: "0.75rem",
  letterSpacing: "-0.3px",
};

const textStyle: React.CSSProperties = {
  lineHeight: 1.8,
  fontSize: "0.95rem",
};

export default function About(): React.JSX.Element {
  return (
    <Layout title="About">
      <main style={{ padding: "2rem 0" }}>
        <div className="about-content" style={{ maxWidth: 640, margin: "0 auto", padding: "0 1rem" }}>
          <h1 style={{
            marginBottom: "2.5rem",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.6px",
            lineHeight: "42px",
            textAlign: "center",
          }}>About</h1>

          <section style={{ ...sectionStyle, display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <img
              src="https://avatars.githubusercontent.com/u/51396905?s=400&u=65840fab9273e12e5b3521af740027adfa28ef62&v=4"
              alt="Doyul Kim"
              style={{ width: 96, height: 96, borderRadius: "50%", flexShrink: 0 }}
            />
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.25rem", fontSize: 20, fontWeight: 600, letterSpacing: "-0.3px" }}>
                Doyul (Ian) Kim
              </h2>
              <p style={{ margin: 0, color: "var(--ifm-color-emphasis-600)", fontSize: "0.9rem" }}>
                Software Engineer · Kubernetes & Rust
              </p>
              <p style={{ margin: "0.15rem 0 0", color: "var(--ifm-color-emphasis-500)", fontSize: "0.85rem" }}>
                STCLab, Inc. · Seoul, South Korea
              </p>
            </div>
          </section>

          <section style={sectionStyle}>
            <p style={textStyle}>
              Developing a Kubernetes workload cost-optimization platform in Rust.
            </p>
            <p style={textStyle}>
              At STCLab, I design and implement core features — alerting, autoscaling,
              resource optimization, and cost analysis — for Kubernetes workloads.
              Built the team's cloud infrastructure (EKS, ROSA) from scratch with Terraform.
            </p>
            <p style={textStyle}>
              Member of <a href="https://github.com/kube-rs/kube">kube-rs</a>,
              a production-grade open-source Kubernetes client for Rust.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Skills</h2>
            <p style={{ ...textStyle, marginBottom: "0.35rem" }}>
              <strong>Languages:</strong> Rust, TypeScript, Java, Python
            </p>
            <p style={{ ...textStyle, marginBottom: "0.35rem" }}>
              <strong>Infrastructure:</strong> Kubernetes (EKS, ROSA), Terraform, Docker, ArgoCD, Helm, Karpenter, Istio
            </p>
            <p style={{ ...textStyle, marginBottom: "0.35rem" }}>
              <strong>Observability:</strong> Prometheus, Grafana, Fluent Bit, Loki, k6
            </p>
            <p style={textStyle}>
              <strong>Data:</strong> DuckDB, Polars, MySQL
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Certifications</h2>
            <ul style={{ ...textStyle, paddingLeft: "1.25rem", margin: 0 }}>
              <li>AWS Certified Solutions Architect – Associate (2024)</li>
              <li>AWS Public Sector GameDay — Third Place (2024)</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionHeadingStyle}>Education</h2>
            <p style={textStyle}>
              <strong>Konkuk University</strong>
              <br />
              Bachelor's Degree, Industrial Engineering (2021)
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>Links</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.95rem", lineHeight: 2 }}>
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

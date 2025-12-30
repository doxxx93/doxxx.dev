import React from "react";
import Layout from "@theme/Layout";

export default function About(): React.JSX.Element {
  return (
    <Layout title="About">
      <main style={{ padding: "2rem 0" }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <h1 style={{ marginBottom: "2rem" }}>About</h1>

          <section style={{ marginBottom: "2.5rem", display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
            <img
              src="https://avatars.githubusercontent.com/u/51396905?s=400&u=65840fab9273e12e5b3521af740027adfa28ef62&v=4"
              alt="Doyul Kim"
              style={{ width: 120, height: 120, borderRadius: "50%" }}
            />
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Doyul (Ian) Kim</h2>
              <p style={{ margin: 0, color: "var(--ifm-color-emphasis-700)" }}>
                Software Engineer | Kubernetes & Rust
              </p>
              <p style={{ margin: "0.25rem 0", color: "var(--ifm-color-emphasis-600)", fontSize: "0.95rem" }}>
                STCLab, Inc. · Seoul, South Korea
              </p>
            </div>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <p style={{ lineHeight: 1.8 }}>
              Developing Kubernetes workload optimization solutions in Rust.
            </p>
            <p style={{ lineHeight: 1.8 }}>
              At STCLab, I design and implement core features including alerting, autoscaling,
              and resource optimization for Kubernetes workloads. I also build and manage the
              team's infrastructure on Amazon EKS.
            </p>
            <p style={{ lineHeight: 1.8 }}>
              Contributing to <a href="https://github.com/kube-rs/kube">kube-rs</a>,
              a production-grade open-source Kubernetes client used in production environments.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Skills</h2>
            <p style={{ lineHeight: 1.8, marginBottom: "0.5rem" }}>
              <strong>Languages:</strong> Rust, TypeScript, Python, Java
            </p>
            <p style={{ lineHeight: 1.8, marginBottom: "0.5rem" }}>
              <strong>Infrastructure:</strong> Kubernetes (EKS, OpenShift), Terraform, ArgoCD, Helm, Karpenter
            </p>
            <p style={{ lineHeight: 1.8 }}>
              <strong>Observability:</strong> Prometheus, Grafana, Istio, Fluent Bit, Loki
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Certifications</h2>
            <ul style={{ lineHeight: 1.8 }}>
              <li>AWS Certified Solutions Architect – Associate (2024)</li>
              <li>AWS Public Sector GameDay - Third Place (2024)</li>
            </ul>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2>Education</h2>
            <p style={{ lineHeight: 1.8 }}>
              <strong>Konkuk University</strong>
              <br />
              Bachelor's Degree, Industrial Engineering
            </p>
          </section>

          <section>
            <h2>Links</h2>
            <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
              <li>
                <a href="https://github.com/doxxx93">GitHub</a>
              </li>
              <li>
                <a href="https://linkedin.com/in/doxxx">LinkedIn</a>
              </li>
              <li>
                <a href="mailto:me@doxxx.dev">me@doxxx.dev</a>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </Layout>
  );
}

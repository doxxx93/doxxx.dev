import React from "react";
import Layout from "@theme/Layout";
import Translate, {translate} from "@docusaurus/Translate";
import styles from "./about.module.scss";

export default function About(): React.JSX.Element {
  return (
    <Layout
      title={translate({id: "about.pageTitle", message: "소개"})}
      description={translate({
        id: "about.pageDescription",
        message:
          "OrderX에서 실시간 트레이딩 시스템을, 오픈소스에서는 kube-rs를 만드는 Rust 시스템 엔지니어",
      })}
    >
      <main style={{ padding: "2rem 0" }}>
        <div className={`about-content ${styles.container}`}>
          <h1 className={styles.title}>
            <Translate id="about.heading">소개</Translate>
          </h1>

          <section className={styles.profile}>
            <img
              src="https://avatars.githubusercontent.com/u/51396905?s=400&u=65840fab9273e12e5b3521af740027adfa28ef62&v=4"
              alt="Doyul Kim"
              className={styles.avatar}
            />
            <div>
              <h2 className={styles.name}>
                <Translate id="about.name">김도율 (Ian)</Translate>
              </h2>
              <p className={styles.role}>
                <Translate id="about.role">
                  소프트웨어 엔지니어 · Rust & 분산 시스템
                </Translate>
              </p>
              <p className={styles.company}>
                <Translate id="about.company">OrderX · 리모트 · 서울</Translate>
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.text}>
              <Translate id="about.intro">
                실시간 멀티에셋 트레이딩 터미널의 주문·체결 관리 시스템을 Rust로
                만들고 있습니다.
              </Translate>
            </p>
            <p className={styles.text}>
              <Translate id="about.current">
                OrderX에서는 여러 공급자와 거래소에 걸친 시세 수집, 파생상품 분석
                화면, 주문 체결을 맡고 있습니다. NATS 위에 올린 20개 이상의 Rust
                마이크로서비스와 QuestDB에 쌓는 시계열 시세 데이터로 돌아갑니다.
                일의 상당 부분은 에러를 내지 않는 장애를 다루는 것입니다.
                프로세스는 정상이라고 보고하는데 half-open 소켓 때문에 피드가
                열흘 동안 죽어 있던 일처럼요.
              </Translate>
            </p>
            <p className={styles.text}>
              <Translate id="about.previous">
                그 전에는 STCLab에서 쿠버네티스 워크로드 비용 최적화 플랫폼의
                Rust 백엔드와 EKS 인프라를 맡았습니다. DuckDB 스토리지 안정화,
                알림 설계, 오토스케일링 재설계, Terraform IaC를 진행했습니다.
              </Translate>
            </p>
            <p className={styles.text}>
              <Translate
                id="about.openSource"
                values={{
                  kubeRs: <a href="https://github.com/kube-rs/kube">kube-rs</a>,
                  kubeCel: (
                    <a href="https://github.com/kube-rs/kube-cel">kube-cel</a>
                  ),
                }}
              >
                {
                  "Rust용 프로덕션 등급 오픈소스 쿠버네티스 클라이언트인 {kubeRs}의 멤버이고, 쿠버네티스 CEL 검증을 클라이언트 쪽으로 가져온 {kubeCel}을 만들었습니다."
                }
              </Translate>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>
              <Translate id="about.skills.heading">기술</Translate>
            </h2>
            <p className={styles.textCompact}>
              <strong>
                <Translate id="about.skills.languages">언어:</Translate>
              </strong>{" "}
              Rust, Java, Python
            </p>
            <p className={styles.textCompact}>
              <strong>
                <Translate id="about.skills.infrastructure">인프라:</Translate>
              </strong>{" "}
              Kubernetes (EKS, ROSA), Terraform, Docker, ArgoCD, Helm, Karpenter, Istio
            </p>
            <p className={styles.textCompact}>
              <strong>
                <Translate id="about.skills.messaging">메시징:</Translate>
              </strong>{" "}
              NATS, Protocol Buffers
            </p>
            <p className={styles.textCompact}>
              <strong>
                <Translate id="about.skills.observability">관측:</Translate>
              </strong>{" "}
              Prometheus, Grafana, Fluent Bit, Loki, k6
            </p>
            <p className={styles.text}>
              <strong>
                <Translate id="about.skills.data">데이터:</Translate>
              </strong>{" "}
              QuestDB, DuckDB, Polars, MySQL
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>
              <Translate id="about.certifications.heading">자격증</Translate>
            </h2>
            <ul className={styles.list}>
              <li>AWS Certified Solutions Architect – Associate (2024)</li>
              <li>
                <Translate id="about.certifications.gameday">
                  AWS Public Sector GameDay — 3위 (2024)
                </Translate>
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>
              <Translate id="about.education.heading">학력</Translate>
            </h2>
            <p className={styles.text}>
              <strong>
                <Translate id="about.education.school">건국대학교</Translate>
              </strong>
              <br />
              <Translate id="about.education.degree">
                산업공학 학사 (2021)
              </Translate>
            </p>
          </section>

          <section>
            <h2 className={styles.sectionHeading}>
              <Translate id="about.links.heading">링크</Translate>
            </h2>
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

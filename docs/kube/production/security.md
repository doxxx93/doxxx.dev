---
sidebar_position: 4
title: "보안"
description: "컨트롤러의 RBAC 설계, 컨테이너 보안, 네트워크 정책, 공급망 보안"
---

# 보안

Kubernetes 컨트롤러는 클러스터 리소스를 생성하고 수정하는 권한을 가집니다. 침해 시 영향 범위가 넓으므로, 설계 단계에서부터 최소 권한과 격리를 적용합니다.

## 위협 모델

컨트롤러가 침해되면 어떤 일이 벌어지는지 먼저 이해합니다.

| 시나리오 | 공격 경로 | 영향 |
|---------|----------|------|
| Pod 침해 | 취약한 의존성, 컨테이너 탈출 | ServiceAccount 토큰으로 API 서버 접근 |
| RBAC 과잉 | ClusterRole에 `*` verb | 침해 시 클러스터 전체 리소스 조작 |
| 이미지 변조 | 레지스트리 침해, 태그 재사용 | 악성 코드 실행 |
| 네트워크 노출 | admission webhook 포트 공개 | 외부에서 webhook 엔드포인트 접근 |

핵심 원칙: **침해가 발생해도 영향 범위를 최소화**하는 것이 목표입니다.

## RBAC 설계

### ClusterRole vs Role

| 구분 | ClusterRole | Role |
|------|------------|------|
| 범위 | 클러스터 전체 | 특정 네임스페이스 |
| 용도 | CRD 정의, 클러스터 스코프 리소스 | 네임스페이스 내 리소스 관리 |
| 위험도 | 높음 — 모든 네임스페이스에 영향 | 낮음 — 해당 네임스페이스만 |

가능하면 Role + RoleBinding으로 범위를 제한합니다. CRD 정의 자체는 클러스터 스코프이므로 CRD 등록용과 런타임 운영용을 분리합니다.

### CRD 분리 전략

```yaml title="CRD 등록용 — CI/CD 파이프라인에서 실행"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-controller-crd-admin
rules:
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    verbs: ["create", "get", "list", "patch"]
```

```yaml title="런타임용 — 컨트롤러 Pod의 ServiceAccount"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-controller-runtime
rules:
  # 주 리소스 (CRD)
  - apiGroups: ["example.com"]
    resources: ["documents"]
    verbs: ["get", "list", "watch", "patch"]
  - apiGroups: ["example.com"]
    resources: ["documents/status"]
    verbs: ["patch"]
  # 자식 리소스
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch", "create", "patch", "delete"]
  # 이벤트 기록
  - apiGroups: ["events.k8s.io"]
    resources: ["events"]
    verbs: ["create"]
```

### 최소 권한 원칙

| 규칙 | 설명 |
|------|------|
| verb 최소화 | `get`, `list`, `watch`만 필요한 리소스에 `*`를 주지 않습니다 |
| resource 명시 | `resources: ["*"]` 대신 정확한 리소스를 나열합니다 |
| status 분리 | 주 리소스 `patch`와 `status` 서브리소스 `patch`를 별도 rule로 관리합니다 |
| apiGroup 제한 | 빈 문자열(`""`)은 core API만, 필요한 group만 명시합니다 |

:::tip[필요한 RBAC 파악하기]
컨트롤러가 실제로 어떤 API를 호출하는지 audit log를 켜서 확인합니다. `kubectl auth can-i --list --as=system:serviceaccount:ns:sa-name`으로 현재 권한을 점검합니다.
:::

## 컨테이너 보안

### SecurityContext

```yaml title="deployment.yaml"
spec:
  containers:
    - name: controller
      securityContext:
        runAsNonRoot: true
        runAsUser: 65534
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]
        seccompProfile:
          type: RuntimeDefault
```

컨트롤러는 네트워크 호출(API 서버) 외에 시스템 권한이 필요하지 않습니다. 모든 capability를 제거하고 읽기 전용 파일시스템으로 실행합니다.

### Minimal 이미지

Rust의 정적 링킹으로 매우 작은 컨테이너 이미지를 만들 수 있습니다.

```dockerfile title="Dockerfile (musl 정적 링킹)"
FROM rust:1.88 AS builder
RUN rustup target add x86_64-unknown-linux-musl
WORKDIR /app
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/controller /controller
# TLS 루트 인증서 (API 서버 연결용)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65534
ENTRYPOINT ["/controller"]
```

| 베이스 이미지 | 크기 | 공격 표면 |
|-------------|------|----------|
| `ubuntu:24.04` | ~78MB | 쉘, 패키지 관리자 포함 |
| `gcr.io/distroless/static` | ~2MB | 쉘 없음, C 라이브러리 없음 |
| `scratch` | 0MB | 바이너리만 존재 |

`scratch`를 쓸 때는 TLS 인증서를 수동으로 복사해야 합니다. kube의 `Client`는 API 서버에 TLS로 연결하므로 루트 인증서가 반드시 필요합니다.

:::warning[musl과 TLS 크레이트]
`rustls` feature를 사용하면 OpenSSL 의존성 없이 순수 Rust TLS가 가능합니다. `openssl-tls` feature는 musl 환경에서 추가 설정이 필요합니다.

```toml
kube = { version = "3.0.1", features = ["runtime", "derive", "rustls-tls"] }
```
:::

## NetworkPolicy

컨트롤러 Pod는 API 서버와만 통신하면 됩니다. deny-all 기본 정책에 필요한 egress만 허용합니다.

```yaml title="networkpolicy.yaml"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: controller-netpol
  namespace: controller-system
spec:
  podSelector:
    matchLabels:
      app: my-controller
  policyTypes: ["Ingress", "Egress"]
  # Ingress: 기본 deny (admission webhook 사용 시만 허용)
  ingress: []
  egress:
    # API 서버
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0  # API 서버 IP로 좁히면 더 좋음
      ports:
        - protocol: TCP
          port: 443
    # DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

[Admission webhook](./admission.md)를 사용하면 API 서버에서 오는 ingress를 추가로 허용해야 합니다:

```yaml title="webhook용 ingress 추가"
ingress:
  - from:
      - ipBlock:
          cidr: 0.0.0.0/0  # API 서버 IP로 제한
    ports:
      - protocol: TCP
        port: 8443  # webhook 리스닝 포트
```

## 공급망 보안

### 의존성 감사

```bash
# 알려진 취약점 검사
cargo audit

# 라이선스 · 중복 · 금지된 크레이트 검사
cargo deny check
```

`cargo-deny`는 CI에 통합하여 매 빌드마다 실행합니다. `deny.toml`에서 허용할 라이선스와 금지할 크레이트를 지정합니다.

```toml title="deny.toml (예시)"
[licenses]
allow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]

[bans]
deny = [
    # openssl 대신 rustls 사용
    { name = "openssl-sys" },
]
```

### SBOM 생성

```bash
# cargo-cyclonedx로 CycloneDX BOM 생성
cargo cyclonedx --format json
```

컨테이너 이미지 레벨에서는 `syft`나 `trivy`로 SBOM을 생성합니다.

### 이미지 서명과 검증

```bash
# cosign으로 이미지 서명
cosign sign --key cosign.key ghcr.io/org/controller:v1.0.0

# 배포 시 서명 검증 (Kyverno 정책 또는 admission controller)
```

태그 대신 digest(`@sha256:...`)로 이미지를 참조하면 이미지 변조 위험을 줄일 수 있습니다.

## ServiceAccount 토큰 관리

Kubernetes 1.22+에서는 바운드 토큰이 기본입니다. 추가 주의사항:

| 설정 | 이유 |
|------|------|
| `automountServiceAccountToken: false` | 필요 없는 Pod에 토큰 마운트 방지 |
| `expirationSeconds: 3600` | 토큰 수명 제한 (기본 1시간) |
| 전용 ServiceAccount | `default` SA를 쓰지 않습니다 |

kube의 `Client::try_default()`는 마운트된 토큰을 자동으로 사용하며, 만료 시 토큰 갱신도 자동입니다.

## 보안 체크리스트

| 항목 | 확인 |
|------|------|
| RBAC에 `*` verb나 `*` resource가 없는가? | |
| CRD 등록과 런타임 권한이 분리되었는가? | |
| SecurityContext에 `runAsNonRoot`, `readOnlyRootFilesystem` 설정했는가? | |
| capability ALL drop 설정했는가? | |
| NetworkPolicy로 불필요한 트래픽을 차단했는가? | |
| `cargo audit` / `cargo deny`가 CI에 통합되었는가? | |
| 이미지에 digest 핀이 적용되었는가? | |
| admission webhook 사용 시 TLS 인증서를 자동 갱신하는가? | |

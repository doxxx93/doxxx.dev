---
sidebar_position: 4
title: "Security"
description: "RBAC design, container security, network policies, and supply chain security for controllers"
---

# Security

Kubernetes controllers have the authority to create and modify cluster resources. Since the blast radius of a compromise is wide, apply least privilege and isolation from the design stage.

## Threat Model

First, understand what happens if a controller is compromised.

| Scenario | Attack Vector | Impact |
|----------|--------------|--------|
| Pod compromise | Vulnerable dependency, container escape | Access to API server via ServiceAccount token |
| RBAC over-privilege | `*` verb in ClusterRole | Full cluster resource manipulation on compromise |
| Image tampering | Registry compromise, tag reuse | Malicious code execution |
| Network exposure | Admission webhook port exposed | External access to the webhook endpoint |

Core principle: The goal is to **minimize the blast radius even if a compromise occurs**.

## RBAC Design

### ClusterRole vs Role

| Type | ClusterRole | Role |
|------|------------|------|
| Scope | Entire cluster | Specific namespace |
| Use case | CRD definitions, cluster-scoped resources | Managing resources within a namespace |
| Risk level | High — affects all namespaces | Low — affects only that namespace |

Where possible, limit scope with Role + RoleBinding. Since CRD definitions themselves are cluster-scoped, separate the CRD registration role from the runtime operational role.

### CRD Separation Strategy

```yaml title="CRD registration — executed in CI/CD pipeline"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-controller-crd-admin
rules:
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    verbs: ["create", "get", "list", "patch"]
```

```yaml title="Runtime — the controller Pod's ServiceAccount"
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-controller-runtime
rules:
  # Primary resource (CRD)
  - apiGroups: ["example.com"]
    resources: ["documents"]
    verbs: ["get", "list", "watch", "patch"]
  - apiGroups: ["example.com"]
    resources: ["documents/status"]
    verbs: ["patch"]
  # Child resources
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch", "create", "patch", "delete"]
  # Event recording
  - apiGroups: ["events.k8s.io"]
    resources: ["events"]
    verbs: ["create"]
```

### Principle of Least Privilege

| Rule | Description |
|------|-------------|
| Minimize verbs | Do not grant `*` to resources that only need `get`, `list`, `watch` |
| Specify resources explicitly | List exact resources instead of `resources: ["*"]` |
| Separate status | Manage the primary resource `patch` and the `status` subresource `patch` as separate rules |
| Restrict apiGroups | An empty string (`""`) means only the core API; specify only the groups you need |

:::tip[Determining Required RBAC]
Turn on audit logging to see which APIs the controller actually calls. Use `kubectl auth can-i --list --as=system:serviceaccount:ns:sa-name` to review current permissions.
:::

## Container Security

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

Controllers do not need system privileges beyond network calls (to the API server). Drop all capabilities and run with a read-only filesystem.

### Minimal Image

Rust's static linking allows you to build extremely small images.

```dockerfile title="Dockerfile (musl static linking)"
FROM rust:1.88 AS builder
RUN rustup target add x86_64-unknown-linux-musl
WORKDIR /app
COPY . .
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/controller /controller
# TLS root certificates (for API server connections)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65534
ENTRYPOINT ["/controller"]
```

| Base Image | Size | Attack Surface |
|-----------|------|---------------|
| `ubuntu:24.04` | ~78MB | Includes shell, package manager |
| `gcr.io/distroless/static` | ~2MB | No shell, no C library |
| `scratch` | 0MB | Only the binary |

When using `scratch`, you must manually copy TLS certificates. kube's `Client` connects to the API server via TLS, so root certificates are required.

:::warning[musl and TLS Crates]
Using the `rustls` feature enables pure Rust TLS without an OpenSSL dependency. The `openssl-tls` feature requires additional configuration in musl environments.

```toml
kube = { version = "3.0.1", features = ["runtime", "derive", "rustls-tls"] }
```
:::

## NetworkPolicy

Controller Pods only need to communicate with the API server. Start with a deny-all default policy and allow only necessary egress.

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
  # Ingress: default deny (allow only if using admission webhooks)
  ingress: []
  egress:
    # API server
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0  # Even better if narrowed to the API server IP
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

If you use [Admission webhooks](./admission.md), you need to additionally allow ingress from the API server:

```yaml title="Additional ingress for webhooks"
ingress:
  - from:
      - ipBlock:
          cidr: 0.0.0.0/0  # Restrict to API server IP
    ports:
      - protocol: TCP
        port: 8443  # webhook listening port
```

## Supply Chain Security

### Dependency Auditing

```bash
# Check for known vulnerabilities
cargo audit

# Check licenses, duplicates, and banned crates
cargo deny check
```

Integrate `cargo-deny` into CI to run on every build. Specify allowed licenses and banned crates in `deny.toml`.

```toml title="deny.toml (example)"
[licenses]
allow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]

[bans]
deny = [
    # Use rustls instead of openssl
    { name = "openssl-sys" },
]
```

### SBOM Generation

```bash
# Generate CycloneDX BOM with cargo-cyclonedx
cargo cyclonedx --format json
```

At the container image level, use `syft` or `trivy` to generate SBOMs.

### Image Signing and Verification

```bash
# Sign the image with cosign
cosign sign --key cosign.key ghcr.io/org/controller:v1.0.0

# Verify the signature at deployment time (via Kyverno policy or admission controller)
```

Referencing images by digest (`@sha256:...`) instead of tags reduces the risk of image tampering.

## ServiceAccount Token Management

Starting with Kubernetes 1.22+, bound tokens are the default. Additional considerations:

| Setting | Reason |
|---------|--------|
| `automountServiceAccountToken: false` | Prevents token mounting on Pods that don't need it |
| `expirationSeconds: 3600` | Limits token lifetime (default 1 hour) |
| Dedicated ServiceAccount | Do not use the `default` SA |

kube's `Client::try_default()` automatically uses the mounted token, and token renewal on expiry is also automatic.

## Security Checklist

| Item | Verified |
|------|----------|
| Are there no `*` verbs or `*` resources in RBAC? | |
| Are CRD registration and runtime permissions separated? | |
| Is SecurityContext configured with `runAsNonRoot`, `readOnlyRootFilesystem`? | |
| Is capability ALL drop configured? | |
| Is unnecessary traffic blocked with NetworkPolicy? | |
| Are `cargo audit` / `cargo deny` integrated into CI? | |
| Is digest pinning applied to images? | |
| If using admission webhooks, are TLS certificates automatically renewed? | |

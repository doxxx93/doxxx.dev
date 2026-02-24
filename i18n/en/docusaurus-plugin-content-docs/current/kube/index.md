---
sidebar_position: 1
title: "kube"
description: "An in-depth guide to the Rust Kubernetes client library"
---

# kube

A Kubernetes client library written in Rust. It is the Rust counterpart to Go's [client-go](https://github.com/kubernetes/client-go) and is hosted as a [CNCF Sandbox](https://www.cncf.io/projects/) project.

```rust
use kube::{Api, Client};
use k8s_openapi::api::core::v1::Pod;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = Client::try_default().await?;
    let pods: Api<Pod> = Api::default_namespaced(client);

    for pod in pods.list(&Default::default()).await? {
        println!("{}", pod.metadata.name.unwrap_or_default());
    }
    Ok(())
}
```

## About This Guide

This guide is for those who use kube but want a deeper understanding of how it works internally. Rather than covering basic usage, it traces through the actual code implementation to explain **why it was designed this way** and **what happens under the hood**.

### Prerequisites

- Rust fundamentals (traits, generics, async/await)
- Kubernetes basics (Pod, Deployment, CRD, watch, controller)

## Table of Contents

| Section | Description |
|---------|-------------|
| [Architecture](./architecture/index.md) | Crate structure, type system, Client internals, request flow |
| [Runtime Internals](./runtime-internals/index.md) | How watcher/reflector/Controller work |
| [Patterns](./patterns/index.md) | Correct usage patterns and common pitfalls |
| [Production](./production/index.md) | Monitoring, testing, optimization, security, availability, validation |

## Basic Setup

```toml title="Cargo.toml"
[dependencies]
kube = { version = "3.0.1", features = ["runtime", "derive"] }
k8s-openapi = { version = "0.27.0", features = ["latest", "schemars"] }
schemars = "1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
```

## References

- [kube.rs](https://kube.rs) — Official website
- [docs.rs/kube](https://docs.rs/kube) — API reference
- [GitHub](https://github.com/kube-rs/kube) — Source code

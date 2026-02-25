---
sidebar_position: 3
title: "Server-Side Apply"
description: "SSA 패턴, status patching, 흔한 실수"
---

# Server-Side Apply

Server-Side Apply(SSA)는 Kubernetes의 필드 소유권 기반 패치 방식입니다. Reconciler에서 리소스를 생성/수정할 때 SSA를 사용하면 충돌 없는 안전한 다자 수정이 가능합니다.

## 왜 SSA인가

기존 패치 방식의 한계:

| 방식 | 한계 |
|------|------|
| Merge patch | 배열 전체를 덮어씀. 필드 삭제가 명시적이지 않음 |
| Strategic merge patch | k8s-openapi 타입에만 동작. CRD에는 불완전 |
| JSON patch | 정확한 경로 지정 필요. race condition에 취약 |

SSA의 장점:

- **필드 소유권**: "이 컨트롤러가 이 필드를 소유한다"를 서버가 기록합니다
- **충돌 감지**: 다른 소유자의 필드를 건드리면 409 Conflict가 발생합니다
- **선언적**: "이 필드들이 이 값이어야 한다"만 선언하면 나머지는 건드리지 않습니다
- reconciler의 idempotent 패턴과 자연스럽게 맞습니다

## 기본 패턴

```rust
use kube::api::{Patch, PatchParams};

let patch = Patch::Apply(serde_json::json!({
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": { "name": "my-cm" },
    "data": { "key": "value" }
}));
let pp = PatchParams::apply("my-controller"); // field manager 이름
api.patch("my-cm", &pp, &patch).await?;
```

`PatchParams::apply("my-controller")`의 `"my-controller"`가 field manager 이름입니다. 이 이름으로 필드 소유권이 기록됩니다. 같은 field manager로 다시 apply하면 소유 필드가 업데이트되고, 다른 field manager의 필드는 건드리지 않습니다.

## 흔한 실수들

### apiVersion과 kind 누락

```rust
// ✗ 400 Bad Request
let patch = Patch::Apply(serde_json::json!({
    "data": { "key": "value" }
}));

// ✓ apiVersion과 kind 필수
let patch = Patch::Apply(serde_json::json!({
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": { "name": "my-cm" },
    "data": { "key": "value" }
}));
```

Merge patch와 달리 SSA는 `apiVersion`과 `kind`가 필수입니다.

### field manager 미지정

```rust
// ✗ 기본 field manager 사용 → 의도치 않은 소유권 충돌
let pp = PatchParams::default();

// ✓ 명시적 field manager
let pp = PatchParams::apply("my-controller");
```

### force 남용

```rust
// 주의: 다른 field manager의 필드도 강제로 덮어씁니다
let pp = PatchParams::apply("my-controller").force();
```

`force: true`는 다른 컨트롤러의 소유 필드도 강제로 가져옵니다. CRD 등록 등 단일 소유자 상황에서만 사용합니다.

### 불필요한 필드 포함

Rust struct를 통째로 serialization하면 `Default` 값 필드도 포함됩니다. SSA가 해당 필드의 소유권을 가져가서, 다른 컨트롤러가 그 필드를 수정하면 충돌이 발생합니다.

## Status patching

status는 `/status` 서브리소스를 통해 수정합니다.

```rust
let status_patch = serde_json::json!({
    "apiVersion": "example.com/v1",
    "kind": "MyResource",
    "status": {
        "phase": "Ready",
        "conditions": [{
            "type": "Available",
            "status": "True",
            "lastTransitionTime": "2024-01-01T00:00:00Z",
        }]
    }
});
let pp = PatchParams::apply("my-controller");
api.patch_status("name", &pp, &Patch::Apply(status_patch)).await?;
```

:::warning[전체 객체 구조로 감싸야 합니다]
```rust
// ✗ status만 보내면 안 됩니다
serde_json::json!({ "phase": "Ready" })

// ✓ apiVersion, kind, status 구조로 감싸야 합니다
serde_json::json!({
    "apiVersion": "example.com/v1",
    "kind": "MyResource",
    "status": { "phase": "Ready" }
})
```

Kubernetes API가 `/status` 엔드포인트에서도 전체 객체 형태를 기대하기 때문입니다.
:::

## Typed SSA 패턴

`serde_json::json!()` 대신 Rust 타입을 사용하면 타입 안전성과 IDE 자동완성을 얻을 수 있습니다.

```rust
let cm = ConfigMap {
    metadata: ObjectMeta {
        name: Some("my-cm".into()),
        ..Default::default()
    },
    data: Some(BTreeMap::from([("key".into(), "value".into())])),
    ..Default::default()
};
let pp = PatchParams::apply("my-controller");
api.patch("my-cm", &pp, &Patch::Apply(cm)).await?;
```

k8s-openapi 타입은 `#[serde(skip_serializing_if = "Option::is_none")]`이 이미 적용되어 있어 `None` 필드는 serialization되지 않습니다. 커스텀 타입에서는 직접 설정해야 합니다.

```rust
#[derive(Serialize)]
struct MyStatus {
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}
```

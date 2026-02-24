---
sidebar_position: 3
title: "Server-Side Apply"
description: "SSA 패턴, status patching, 흔한 실수"
---

# Server-Side Apply

Server-Side Apply(SSA)는 Kubernetes의 필드 소유권 기반 패치 방식이다. Reconciler에서 리소스를 생성/수정할 때 SSA를 사용하면 충돌 없는 안전한 다자 수정이 가능하다.

## 왜 SSA인가

<!--
기존 패치의 한계:
- Merge patch: 배열 전체를 덮어씀, 필드 삭제가 명시적이지 않음
- Strategic merge patch: k8s-openapi 타입에만 동작, CRD에는 불완전
- JSON patch: 정확한 경로 지정 필요, race condition에 취약

SSA 장점:
- 필드 소유권: "이 컨트롤러가 이 필드를 소유" 기록
- 충돌 감지: 다른 소유자의 필드를 건드리면 409 Conflict
- 선언적: "이 필드들이 이 값이어야 한다" → 나머지는 건드리지 않음
- reconciler의 idempotent 패턴과 자연스럽게 맞음
-->

## 기본 패턴

```rust
let patch = Patch::Apply(serde_json::json!({
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": { "name": "my-cm" },
    "data": { "key": "value" }
}));
let pp = PatchParams::apply("my-controller");
api.patch("my-cm", &pp, &patch).await?;
```

<!--
PatchParams::apply("my-controller"):
- field manager = "my-controller"
- 이 이름으로 필드 소유권 기록
- 같은 field manager로 다시 apply하면 소유 필드 업데이트
- 다른 field manager의 필드는 건드리지 않음
-->

## ⚠️ 흔한 실수들

<!--
1. apiVersion과 kind 누락:
   serde_json::json!({ "data": { "key": "value" } })
   → 400 Bad Request
   SSA는 merge patch와 달리 apiVersion/kind 필수

2. field manager 미지정:
   PatchParams::default()로 하면 기본값 사용
   → 의도치 않은 소유권 충돌

3. force: true 남용:
   PatchParams::apply("my-controller").force()
   → 다른 field manager 소유 필드도 강제로 덮어씀
   → 다른 컨트롤러의 작업을 무효화할 수 있음
   → CRD 등록 등 단일 소유자 상황에서만 사용

4. 불필요한 필드 포함:
   Rust struct를 통째로 직렬화하면 Default 값도 포함
   → SSA가 해당 필드의 소유권을 가져감
   → 다른 컨트롤러가 그 필드를 수정하면 충돌
-->

## Status patching

<!--
Status는 /status 서브리소스를 통해 수정:

let status_patch = serde_json::json!({
    "apiVersion": "example.com/v1",
    "kind": "MyResource",
    "status": {
        "phase": "Ready",
        "conditions": [...]
    }
});
api.patch_status("name", &pp, &Patch::Apply(status_patch)).await?;

⚠️ status만 보내면 안 됨:
serde_json::json!({ "phase": "Ready" })  // ✗
→ 전체 객체 구조(apiVersion, kind, status: { ... })로 감싸야 함

이유: Kubernetes API가 /status 엔드포인트에서도 전체 객체 형태를 기대
-->

## Typed SSA 패턴

<!--
serde_json::json!() 대신 Rust 타입 사용:

let cm = ConfigMap {
    metadata: ObjectMeta {
        name: Some("my-cm".into()),
        ..Default::default()
    },
    data: Some(BTreeMap::from([("key".into(), "value".into())])),
    ..Default::default()
};
api.patch("my-cm", &pp, &Patch::Apply(cm)).await?;

장점: 타입 안전, 자동완성
단점: ..Default::default()가 None/빈값 필드를 직렬화할 수 있음
→ #[serde(skip_serializing_if = "Option::is_none")] 필요
→ k8s-openapi 타입은 이미 적용되어 있음
→ 커스텀 타입에서는 직접 설정 필요
-->

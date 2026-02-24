---
sidebar_position: 3
title: "Server-Side Apply"
description: "SSA patterns, status patching, and common mistakes"
---

# Server-Side Apply

Server-Side Apply (SSA) is Kubernetes' field-ownership-based patching mechanism. Using SSA when creating/modifying resources in a reconciler enables safe, conflict-free multi-actor modifications.

## Why SSA

Limitations of traditional patching approaches:

| Approach | Limitation |
|----------|-----------|
| Merge patch | Overwrites entire arrays. Field deletion is not explicit. |
| Strategic merge patch | Only works with k8s-openapi types. Incomplete for CRDs. |
| JSON patch | Requires exact path specification. Vulnerable to race conditions. |

Advantages of SSA:

- **Field ownership**: The server records "this controller owns this field"
- **Conflict detection**: Touching another owner's field results in a 409 Conflict
- **Declarative**: You only declare "these fields should have these values" and leave everything else untouched
- Naturally fits the idempotent pattern of reconcilers

## Basic Pattern

```rust
use kube::api::{Patch, PatchParams};

let patch = Patch::Apply(serde_json::json!({
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": { "name": "my-cm" },
    "data": { "key": "value" }
}));
let pp = PatchParams::apply("my-controller"); // field manager name
api.patch("my-cm", &pp, &patch).await?;
```

The `"my-controller"` in `PatchParams::apply("my-controller")` is the field manager name. Field ownership is recorded under this name. Applying again with the same field manager updates the owned fields, while leaving other field managers' fields untouched.

## Common Mistakes

### Missing apiVersion and kind

```rust
// ✗ 400 Bad Request
let patch = Patch::Apply(serde_json::json!({
    "data": { "key": "value" }
}));

// ✓ apiVersion and kind are required
let patch = Patch::Apply(serde_json::json!({
    "apiVersion": "v1",
    "kind": "ConfigMap",
    "metadata": { "name": "my-cm" },
    "data": { "key": "value" }
}));
```

Unlike merge patch, SSA requires `apiVersion` and `kind`.

### Missing field manager

```rust
// ✗ Uses default field manager → unintended ownership conflicts
let pp = PatchParams::default();

// ✓ Explicit field manager
let pp = PatchParams::apply("my-controller");
```

### Overusing force

```rust
// Caution: forcefully takes over fields owned by other field managers
let pp = PatchParams::apply("my-controller").force();
```

`force: true` forcefully takes ownership of fields from other controllers. Use it only in single-owner scenarios such as CRD registration.

### Including unnecessary fields

When serializing an entire Rust struct, fields with `Default` values are also included. SSA takes ownership of those fields, causing conflicts when another controller tries to modify them.

## Status Patching

Status is modified through the `/status` subresource.

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

:::warning[Must be wrapped in the full object structure]
```rust
// ✗ Don't send just the status
serde_json::json!({ "phase": "Ready" })

// ✓ Must be wrapped with apiVersion, kind, and status structure
serde_json::json!({
    "apiVersion": "example.com/v1",
    "kind": "MyResource",
    "status": { "phase": "Ready" }
})
```

This is because the Kubernetes API expects the full object structure even at the `/status` endpoint.
:::

## Typed SSA Pattern

Using Rust types instead of `serde_json::json!()` gives you type safety and IDE autocompletion.

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

k8s-openapi types already have `#[serde(skip_serializing_if = "Option::is_none")]` applied, so `None` fields are not serialized. For custom types, you need to set this yourself.

```rust
#[derive(Serialize)]
struct MyStatus {
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}
```

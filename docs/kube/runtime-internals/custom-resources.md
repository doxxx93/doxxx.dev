---
sidebar_position: 4
title: "CRD와 derive 매크로"
description: "#[derive(CustomResource)]가 생성하는 코드와 스키마 생성 과정"
---

# CRD와 derive 매크로

`#[derive(CustomResource)]`는 Rust struct 하나에서 Kubernetes Custom Resource Definition 전체를 생성합니다. 이 매크로가 실제로 어떤 코드를 만들어내는지, 스키마가 어떻게 생성되는지 이해하면 CRD 관련 문제를 디버깅할 수 있습니다.

## 입력 코드

```rust
#[derive(CustomResource, Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[kube(group = "example.com", version = "v1", kind = "Document")]
#[kube(namespaced, status = "DocumentStatus")]
pub struct DocumentSpec {
    pub title: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub struct DocumentStatus {
    pub phase: String,
}
```

사용자가 정의하는 것은 `DocumentSpec`(과 선택적 `DocumentStatus`)뿐입니다. 나머지는 매크로가 생성합니다.

## 생성되는 코드

`#[derive(CustomResource)]`가 만들어내는 것을 `cargo expand`로 확인할 수 있습니다.

### 1. Document 구조체

```rust title="생성된 코드 (단순화)"
pub struct Document {
    pub metadata: ObjectMeta,
    pub spec: DocumentSpec,
    pub status: Option<DocumentStatus>,
}
```

사용자가 정의한 `DocumentSpec`이 `spec` 필드로, `DocumentStatus`가 `status` 필드로 들어갑니다. `metadata`는 항상 `ObjectMeta`입니다.

### 2. Resource trait 구현

```rust title="생성된 코드 (단순화)"
impl Resource for Document {
    type DynamicType = ();
    type Scope = NamespaceResourceScope; // #[kube(namespaced)]

    fn kind(_: &()) -> Cow<'_, str> { "Document".into() }
    fn group(_: &()) -> Cow<'_, str> { "example.com".into() }
    fn version(_: &()) -> Cow<'_, str> { "v1".into() }
    fn plural(_: &()) -> Cow<'_, str> { "documents".into() }
    fn meta(&self) -> &ObjectMeta { &self.metadata }
    fn meta_mut(&mut self) -> &mut ObjectMeta { &mut self.metadata }
}
```

`#[kube(namespaced)]`가 없으면 `Scope = ClusterResourceScope`가 됩니다.

### 3. CustomResourceExt 구현

```rust title="생성된 코드 (단순화)"
impl CustomResourceExt for Document {
    fn crd() -> CustomResourceDefinition { /* CRD 전체 구조 생성 */ }
    fn crd_name() -> &'static str { "documents.example.com" }
    fn api_resource() -> ApiResource { /* ApiResource 생성 */ }
    fn shortnames() -> &'static [&'static str] { &[] }
}
```

### 4. 기타 구현

- `HasSpec for Document` — `fn spec(&self) -> &DocumentSpec`
- `HasStatus for Document` — `fn status(&self) -> Option<&DocumentStatus>` (status 지정 시)
- `Document::new(name, spec)` — 새 인스턴스 생성 편의 함수

## 스키마 생성 과정

CRD 스키마는 세 단계를 거칩니다:

1. `DocumentSpec`의 `#[derive(JsonSchema)]` (schemars)가 OpenAPI v3 JSON 스키마를 생성합니다
2. kube-derive가 이 스키마를 CRD의 `.spec.versions[].schema.openAPIV3Schema` 필드에 삽입합니다
3. `Document::crd()`를 호출하면 완성된 CRD가 반환됩니다

최종 CRD의 구조:

```yaml title="Document::crd()가 생성하는 CRD"
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: documents.example.com
spec:
  group: example.com
  names:
    kind: Document
    plural: documents
    singular: document
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        properties:
          spec:
            properties:
              title: { type: string }
              content: { type: string }
            required: [title, content]
          status:
            properties:
              phase: { type: string }
```

## 주요 #[kube(...)] 어트리뷰트

### 필수

| 어트리뷰트 | 설명 |
|-----------|------|
| `group = "example.com"` | CRD의 API group |
| `version = "v1"` | API version |
| `kind = "Document"` | 리소스 kind |

### 스코프와 서브리소스

```rust
#[kube(namespaced)]                     // 네임스페이스 스코프 (없으면 클러스터)
#[kube(status = "DocumentStatus")]      // /status 서브리소스 활성화
#[kube(scale = r#"{"specReplicasPath": ".spec.replicas", "statusReplicasPath": ".status.replicas"}"#)]
```

### 메타데이터

```rust
#[kube(shortname = "doc")]              // kubectl get doc
#[kube(category = "example")]           // kubectl get example (그룹 조회)
#[kube(printcolumn = r#"{"name":"Phase","type":"string","jsonPath":".status.phase"}"#)]
#[kube(selectable = ".spec.title")]     // field selector 지원
```

### 스키마 제어

```rust
#[kube(schema = "derived")]             // 기본: schemars에서 자동 생성
#[kube(schema = "manual")]              // 수동 스키마 지정
#[kube(schema = "disabled")]            // 스키마 비활성화
#[kube(doc = "문서 리소스 설명")]          // CRD description
```

### CEL 검증

```rust
#[kube(validation = Rule::new("self.spec.title.size() > 0"))]
```

Kubernetes 서버 측에서 CEL(Common Expression Language) 검증을 수행합니다.

### 버전 관리

```rust
#[kube(storage)]                        // 이 버전을 etcd에 저장
#[kube(served = true)]                  // API에서 제공
#[kube(deprecated = "v2로 마이그레이션")]  // 사용 중단 표시
```

## 스키마 관련 함정들

### untagged enum

```rust
#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
enum Value {
    String(String),
    Number(i64),
}
```

schemars가 `anyOf` 스키마를 생성합니다. Kubernetes가 이를 structural schema로 인정하지 않아 거부할 수 있습니다.

**대응**: `#[schemars(schema_with = "custom_schema")]`로 수동 스키마를 지정합니다.

### flatten HashMap

```rust
#[derive(Serialize, Deserialize, JsonSchema)]
struct Config {
    name: String,
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}
```

schemars가 `additionalProperties`를 생성하는데, OpenAPI v3 스키마와 호환되지 않을 수 있습니다.

### ArgoCD drift

kube-derive가 빈 `shortNames`, `categories` 등을 기본값으로 생성합니다. Kubernetes API 서버는 이런 빈 배열을 strip하므로, etcd에 저장된 CRD와 `Document::crd()`가 생성한 CRD 사이에 차이가 생깁니다. ArgoCD가 이를 영구 drift로 감지합니다.

:::tip[cargo expand로 디버깅]
매크로가 생성한 코드를 확인하려면 `cargo expand`를 사용합니다:

```bash
cargo expand --lib | grep -A 50 "impl Resource for Document"
```
:::

## CRD 등록 패턴

Server-Side Apply로 CRD를 등록하고 활성화될 때까지 대기하는 패턴입니다:

```rust
use kube::runtime::wait::conditions;

let crds = Document::crd();
let crd_api: Api<CustomResourceDefinition> = Api::all(client.clone());

// SSA로 CRD 등록/업데이트
let pp = PatchParams::apply("my-controller").force();
crd_api.patch("documents.example.com", &pp, &Patch::Apply(crds)).await?;

// CRD가 Established 상태가 될 때까지 대기
let establish = conditions::is_crd_established();
let crd = tokio::time::timeout(
    Duration::from_secs(10),
    kube::runtime::wait::await_condition(crd_api, "documents.example.com", establish),
).await??;
```

## 다른 derive 매크로

### #[derive(Resource)]

기존 타입에 `Resource` trait을 구현합니다. k8s-openapi 타입을 래핑하는 struct에 유용합니다.

```rust
#[derive(Resource, Clone, Debug, Serialize, Deserialize)]
#[resource(inherit = "ConfigMap")]
struct MyConfigMap {
    metadata: ObjectMeta,
    data: Option<BTreeMap<String, String>>,
}
```

### #[derive(KubeSchema)]

CEL 검증 룰이 포함된 `JsonSchema` 구현을 생성합니다. `CustomResource`와 함께 쓰거나 단독으로 사용할 수 있습니다. CEL 검증의 상세한 사용법은 [Admission 검증 — CEL 검증](../production/admission.md#cel-검증)에서 다룹니다.

## 스키마 오버라이드

schemars가 생성하는 기본 스키마가 Kubernetes의 structural schema 요구사항과 맞지 않을 때, 필드 단위로 스키마를 오버라이드합니다.

### schemars(schema_with)

`#[schemars(schema_with = "함수명")]`으로 특정 필드의 스키마를 완전히 대체합니다:

```rust
use schemars::schema::{Schema, SchemaObject, InstanceType};

fn quantity_schema(_gen: &mut schemars::SchemaGenerator) -> Schema {
    Schema::Object(SchemaObject {
        instance_type: Some(InstanceType::String.into()),
        format: Some("quantity".to_string()),
        ..Default::default()
    })
}

#[derive(CustomResource, KubeSchema, Serialize, Deserialize, Clone, Debug)]
#[kube(group = "example.com", version = "v1", kind = "MyApp")]
pub struct MyAppSpec {
    #[schemars(schema_with = "quantity_schema")]
    pub memory_limit: String,
}
```

[스키마 관련 함정들](#스키마-관련-함정들)에서 다룬 `untagged enum`이나 `flatten HashMap` 문제를 이 방법으로 해결합니다.

### x-kubernetes-validations

`#[x_kube(validation)]`이 생성하는 `x-kubernetes-validations` 확장은 OpenAPI 스키마의 확장 필드입니다:

```yaml title="생성되는 스키마"
properties:
  title:
    type: string
    x-kubernetes-validations:
      - rule: "self != ''"
        message: "title은 비어있을 수 없습니다"
```

이 확장 필드는 API 서버가 CEL 엔진으로 평가합니다. 스키마 자체의 `type`, `format` 등과는 독립적으로 동작합니다.

## CRD 버전 관리

### 버전별 모듈

CRD를 여러 버전으로 제공할 때, 버전별로 별도 모듈을 만들고 각각 `#[derive(CustomResource)]`를 적용합니다:

```rust
mod v1 {
    #[derive(CustomResource, KubeSchema, Serialize, Deserialize, Clone, Debug)]
    #[kube(group = "example.com", version = "v1", kind = "Document")]
    #[kube(namespaced, status = "DocumentStatus")]
    pub struct DocumentSpec {
        pub title: String,
    }
}

mod v2 {
    #[derive(CustomResource, KubeSchema, Serialize, Deserialize, Clone, Debug)]
    #[kube(group = "example.com", version = "v2", kind = "Document")]
    #[kube(namespaced, status = "DocumentStatus")]
    pub struct DocumentSpec {
        pub title: String,
        pub category: String,  // v2에서 추가
    }
}
```

### merge_crds()

`merge_crds()`로 여러 단일 버전 CRD를 하나의 멀티 버전 CRD로 합칩니다:

```rust title="kube-core/src/crd.rs"
pub fn merge_crds(crds: Vec<CustomResourceDefinition>, stored_apiversion: &str)
    -> Result<CustomResourceDefinition, MergeError>
```

```rust
use kube::core::crd::merge_crds;

let merged = merge_crds(
    vec![v1::Document::crd(), v2::Document::crd()],
    "v2",  // etcd에 저장할 버전
)?;

// merged CRD를 API 서버에 등록
crd_api.patch("documents.example.com", &pp, &Patch::Apply(merged)).await?;
```

`merge_crds()`는 다음을 검증합니다:
- 모든 CRD의 `spec.group`이 동일한지
- 모든 CRD의 `spec.names.kind`가 동일한지
- 모든 CRD의 `spec.scope`가 동일한지
- 각 입력 CRD가 단일 버전인지

`stored_apiversion`으로 지정한 버전만 `storage: true`로, 나머지는 `storage: false`로 설정됩니다.

:::warning[버전 간 변환]
Kubernetes는 저장된 버전과 다른 버전으로 요청이 올 때 변환(conversion)을 수행합니다. 단순한 필드 추가/제거는 API 서버가 자동 처리하지만, 복잡한 변환은 conversion webhook이 필요합니다.
:::

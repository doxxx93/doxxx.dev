---
sidebar_position: 4
title: "CRD와 derive 매크로"
description: "#[derive(CustomResource)]가 생성하는 코드와 스키마 생성 과정"
---

# CRD와 derive 매크로

`#[derive(CustomResource)]`는 Rust struct 하나에서 Kubernetes Custom Resource Definition 전체를 생성한다. 이 매크로가 실제로 어떤 코드를 만들어내는지, 스키마가 어떻게 생성되는지 이해하면 CRD 관련 문제를 디버깅할 수 있다.

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

## 생성되는 코드

<!--
매크로가 만들어내는 것:

1. Document 구조체:
   pub struct Document {
       pub metadata: ObjectMeta,
       pub spec: DocumentSpec,
       pub status: Option<DocumentStatus>,
   }

2. impl Resource for Document:
   - kind() → "Document"
   - group() → "example.com"
   - version() → "v1"
   - plural() → "documents"
   - meta() → &self.metadata
   - Scope = NamespaceResourceScope (namespaced 어트리뷰트)
   - DynamicType = ()

3. impl CustomResourceExt for Document:
   - fn crd() → CustomResourceDefinition
   - CRD에 스키마, 프린트 컬럼, 카테고리 등 포함

4. impl HasSpec for Document
5. impl HasStatus for Document (status 지정 시)
6. fn new(name: &str, spec: DocumentSpec) → Self

핵심: 사용자가 Spec만 정의하면 나머지는 매크로가 생성
-->

## 스키마 생성 과정

<!--
1. DocumentSpec에 대해 schemars::JsonSchema derive
   → OpenAPI v3 JSON 스키마 생성

2. kube-derive가 이 스키마를 CRD의
   .spec.versions[].schema.openAPIV3Schema 필드에 삽입

3. 최종 CRD YAML:
   apiVersion: apiextensions.k8s.io/v1
   kind: CustomResourceDefinition
   metadata:
     name: documents.example.com
   spec:
     group: example.com
     names:
       kind: Document
       plural: documents
     scope: Namespaced
     versions:
     - name: v1
       schema:
         openAPIV3Schema:
           properties:
             spec:
               properties:
                 title: { type: string }
                 content: { type: string }
             status:
               properties:
                 phase: { type: string }
-->

## 주요 #[kube(...)] 어트리뷰트

<!--
필수:
- group = "example.com"
- version = "v1"
- kind = "Document"

스코프:
- namespaced (없으면 클러스터 스코프)

서브리소스:
- status = "StatusType"
- scale(spec_replicas_path = ".spec.replicas", ...)

메타데이터:
- printcolumn = r#"{"name":"Phase","type":"string","jsonPath":".status.phase"}"#
- shortname = "doc"
- category = "example"
- selectable = ".spec.title"

스키마:
- schema = "derived" (기본) / "manual" / "disabled"
- doc = "CRD 설명"

검증:
- validation = Rule::new("self.spec.title.size() > 0")

버전 관리:
- storage = true
- served = true
- deprecated = "v2로 마이그레이션 필요"
-->

## ⚠️ 스키마 관련 함정들

<!--
1. #[serde(untagged)] enum:
   → schemars가 anyOf 스키마 생성
   → Kubernetes가 structural schema로 인정 안 할 수 있음
   → 대응: #[schemars(schema_with = "custom_schema")] 사용

2. Option<MyEnum> + doc comment:
   → anyOf 안에 description 들어가는 버그 (kube 3.0.0)
   → Kubernetes가 non-structural로 거부

3. #[serde(flatten)] HashMap<String, Value>:
   → schemars가 additionalProperties 생성
   → OpenAPI v3 스키마와 호환 안 될 수 있음

4. ArgoCD drift:
   → kube-derive가 기본값(빈 shortNames, categories 등) 생성
   → Kubernetes가 기본값을 strip → etcd에 저장된 것과 차이
   → ArgoCD가 영구 drift로 감지

일반적 대응: cargo expand로 생성된 코드 확인
-->

## CRD 등록 패턴

<!--
let crds = Document::crd();
let crd_api: Api<CustomResourceDefinition> = Api::all(client.clone());

// Server-Side Apply로 CRD 등록/업데이트
let pp = PatchParams::apply("my-controller").force();
crd_api.patch("documents.example.com", &pp, &Patch::Apply(crds)).await?;

// CRD가 등록될 때까지 대기
let establish = await_condition(
    crd_api,
    "documents.example.com",
    is_crd_established(),
);
tokio::time::timeout(Duration::from_secs(10), establish).await??;
-->

## 다른 derive 매크로

<!--
#[derive(Resource)]:
- 기존 k8s-openapi 타입을 래핑하는 struct에 Resource impl 생성
- #[resource(inherit = "ConfigMap")]
- 사용 사례: ConfigMap에 커스텀 메서드를 추가한 래퍼 타입

#[derive(KubeSchema)]:
- CEL 검증 룰이 포함된 JsonSchema 생성
- #[x_kube(validation = Rule::new("..."))]
- CustomResource와 함께 쓰거나 단독 사용
-->

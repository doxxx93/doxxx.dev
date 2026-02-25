---
sidebar_position: 2
title: "Resource trait과 타입 시스템"
description: "kube의 타입 안전성이 어떻게 작동하는지 — DynamicType, Scope, blanket impl"
---

# Resource trait과 타입 시스템

kube의 핵심은 `Resource` trait입니다. 이 trait 하나로 정적 타입(k8s-openapi)과 동적 타입(DynamicObject)을 동일한 인터페이스로 다루면서, Scope를 통해 컴파일 타임에 잘못된 API 호출을 방지합니다.

## Resource trait 해부

```rust title="kube-core/src/resource.rs (단순화)"
pub trait Resource {
    type DynamicType: Send + Sync + 'static;
    type Scope;

    fn kind(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn group(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn version(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn api_version(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn plural(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn url_path(dt: &Self::DynamicType, namespace: Option<&str>) -> String;

    fn meta(&self) -> &ObjectMeta;
    fn meta_mut(&mut self) -> &mut ObjectMeta;

    fn object_ref(&self, dt: &Self::DynamicType) -> ObjectReference;
    fn controller_owner_ref(&self, dt: &Self::DynamicType) -> Option<OwnerReference>;
    fn owner_ref(&self, dt: &Self::DynamicType) -> Option<OwnerReference>;
}
```

두 가지 연관 타입이 이 trait의 핵심입니다.

### DynamicType — 메타데이터의 위치

`DynamicType`은 리소스의 GVK(Group/Version/Kind) 정보를 **어디에서** 가져올지 결정합니다.

- **`()`** — 정적 타입. kind/group/version이 타입 자체에 컴파일 타임에 내장됩니다. 런타임 비용이 없습니다.
- **`ApiResource`** — 동적 타입. GVK 정보를 런타임에 들고 다닙니다.

`kind()`, `group()`, `version()` 등의 메서드가 `&Self::DynamicType`을 매개변수로 받는 이유가 여기에 있습니다. 정적 타입은 `()`를 받아서 무시하고 상수를 반환하고, 동적 타입은 `ApiResource`에서 값을 꺼냅니다.

### Scope — 리소스 범위

리소스가 네임스페이스에 속하는지, 클러스터 전역인지를 타입 레벨에서 표현합니다.

| Scope 타입 | 의미 | 예시 |
|-----------|------|------|
| `NamespaceResourceScope` | 네임스페이스에 속하는 리소스 | Pod, Service, ConfigMap |
| `ClusterResourceScope` | 클러스터 전역 리소스 | Node, Namespace, ClusterRole |
| `DynamicResourceScope` | 런타임에 결정 | DynamicObject |

## blanket impl — k8s-openapi 자동 연결

kube-core는 k8s-openapi의 모든 타입에 대해 `Resource` trait을 자동으로 구현합니다.

```rust title="kube-core/src/resource.rs (단순화)"
impl<K, S> Resource for K
where
    K: k8s_openapi::Metadata<Ty = ObjectMeta>,
    K: k8s_openapi::Resource<Scope = S>,
{
    type DynamicType = ();
    type Scope = S;

    fn kind(_: &()) -> Cow<'_, str> {
        K::KIND.into()
    }
    fn group(_: &()) -> Cow<'_, str> {
        K::GROUP.into()
    }
    fn version(_: &()) -> Cow<'_, str> {
        K::VERSION.into()
    }
    // ...
}
```

이 blanket impl이 두 크레이트(k8s-openapi와 kube-core)를 연결하는 다리입니다. `Pod`, `Deployment`, `Service` 등 k8s-openapi의 모든 타입이 자동으로 kube의 `Resource`를 구현하므로, 사용자가 별도로 impl을 작성할 필요가 없습니다.

`DynamicType = ()`이기 때문에 모든 메타데이터(`KIND`, `GROUP`, `VERSION`)는 상수에서 가져옵니다. 런타임 오버헤드가 없습니다.

## Scope — 컴파일 타임 안전성

`Api<K>`의 생성자는 `K::Scope`를 검사해서 잘못된 조합을 컴파일 타임에 차단합니다.

```rust
use k8s_openapi::api::core::v1::{Pod, Node, Namespace};

let client = Client::try_default().await?;

// Pod은 NamespaceResourceScope → Api::namespaced() 사용 가능
let pods: Api<Pod> = Api::namespaced(client.clone(), "default");

// Node는 ClusterResourceScope → Api::all()만 사용 가능
let nodes: Api<Node> = Api::all(client.clone());

// 클러스터 스코프 리소스를 Api::namespaced()로 만들면 컴파일 에러
// let ns: Api<Namespace> = Api::namespaced(client.clone(), "default");
// error: Namespace: Resource<Scope = ClusterResourceScope>
//        but expected NamespaceResourceScope
```

`Api::all()`은 모든 Scope에서 사용 가능합니다. 네임스페이스 스코프 리소스에 대해 `Api::all()`을 쓰면 모든 네임스페이스의 리소스를 조회합니다.

:::tip[default_namespaced]
`Api::default_namespaced(client)`는 `Config`에서 추론된 기본 네임스페이스를 사용합니다. kubeconfig의 현재 context namespace, 또는 in-cluster라면 Pod이 실행되는 네임스페이스입니다.
:::

## DynamicType 활용

리소스 타입을 다루는 세 가지 패턴이 있습니다.

### 1. 정적 타입 — DynamicType = ()

k8s-openapi 타입이나 `#[derive(CustomResource)]`로 생성한 타입입니다. 가장 일반적인 패턴입니다.

```rust
// k8s-openapi 타입
let pods: Api<Pod> = Api::namespaced(client.clone(), "default");
let pod = pods.get("my-pod").await?;
println!("{}", pod.metadata.name.unwrap());

// derive로 생성한 CRD 타입
let docs: Api<Document> = Api::namespaced(client, "default");
```

모든 GVK 정보가 타입에 내장되어 있으므로 추가 인자가 필요 없습니다.

### 2. 동적 타입 — DynamicType = ApiResource

컴파일 타임에 타입을 모를 때 `DynamicObject`를 사용합니다. GVK 정보를 런타임에 `ApiResource`로 전달합니다.

```rust
use kube::core::{DynamicObject, ApiResource, GroupVersionKind};

let gvk = GroupVersionKind::gvk("example.com", "v1", "Document");
let ar = ApiResource::from_gvk(&gvk);
let api = Api::<DynamicObject>::namespaced_with(client, "default", &ar);

let obj = api.get("my-doc").await?;
// 필드 접근은 serde_json::Value를 통해
let title = obj.data["spec"]["title"].as_str();
```

:::warning[타입 안전성 없음]
`DynamicObject`의 필드 접근은 모두 `serde_json::Value`를 통하므로, 존재하지 않는 필드에 접근해도 컴파일 에러가 아닌 런타임에 `None`을 반환합니다.
:::

### 3. 반동적 타입 — Object&lt;P, U&gt;

spec/status 구조는 알지만 GVK는 런타임에 결정해야 할 때 사용합니다. 정적 타입과 동적 타입의 중간 지점입니다.

```rust
use kube::core::Object;

#[derive(Deserialize, Serialize, Clone, Debug)]
struct MySpec {
    replicas: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
struct MyStatus {
    ready: bool,
}

type MyResource = Object<MySpec, MyStatus>;
// spec과 status는 타입 안전하게 접근
// GVK는 ApiResource로 런타임에 지정
```

서드파티 CRD를 다룰 때 유용한 패턴입니다. 자세한 내용은 [서드파티 CRD](../patterns/third-party-crds.md)에서 다룹니다.

## ResourceExt — 편의 메서드

`ResourceExt`는 `Resource`를 구현한 모든 타입에 편의 메서드를 제공하는 extension trait입니다.

```rust
use kube::ResourceExt;

let pod: Pod = api.get("my-pod").await?;

// 이름과 네임스페이스
let name = pod.name_any();       // name 또는 generateName 반환
let ns = pod.namespace();         // Option<String>

// 메타데이터 접근
let labels = pod.labels();        // &BTreeMap<String, String>
let annotations = pod.annotations();
let finalizers = pod.finalizers(); // &[String]
let owner_refs = pod.owner_references(); // &[OwnerReference]

// 식별자
let uid = pod.uid();              // Option<String>
let rv = pod.resource_version();  // Option<String>
```

:::tip[name_any vs name_unchecked]
`name_any()`는 `metadata.name`이 없으면 `metadata.generateName`을 반환합니다. `name_unchecked()`는 `metadata.name`이 없으면 패닉합니다. 리소스가 이미 API 서버에 존재한다면(즉, `get()`으로 가져왔다면) `name_unchecked()`를 써도 안전합니다.
:::

## ObjectRef — 리소스 참조

`ObjectRef<K>`는 리소스를 식별하는 경량 참조입니다. Controller 내부에서 reconcile 대상을 추적하는 키로 사용됩니다.

```rust title="kube-runtime/src/reflector/object_ref.rs (단순화)"
#[non_exhaustive]
pub struct ObjectRef<K: Lookup + ?Sized> {
    pub dyntype: K::DynamicType,
    pub name: String,
    pub namespace: Option<String>,
    pub extra: Extra, // resource_version, uid 등
}
```

핵심 특성:

- **Hash/Eq**: `name`과 `namespace`만 비교합니다. `resourceVersion`이나 `uid`는 무시됩니다. 이 덕분에 같은 리소스의 서로 다른 버전이 같은 `ObjectRef`로 취급됩니다.
- **중복 제거**: Controller의 scheduler가 `ObjectRef`를 키로 사용해서, 같은 리소스에 대한 중복 reconcile 요청을 하나로 합칩니다.
- **타입 지우기**: `.erase()`로 `ObjectRef<DynamicObject>`로 변환할 수 있습니다. 서로 다른 타입의 ObjectRef를 한 컬렉션에 담을 때 사용합니다.

`ObjectRef`가 Controller 파이프라인에서 어떻게 활용되는지는 [Controller 파이프라인](../runtime-internals/controller-pipeline.md)에서 다룹니다.

---
sidebar_position: 2
title: "Resource trait과 타입 시스템"
description: "kube의 타입 안전성이 어떻게 작동하는지 — DynamicType, Scope, blanket impl"
---

# Resource trait과 타입 시스템

kube의 핵심은 `Resource` trait이다. 이 trait 하나로 정적 타입(k8s-openapi)과 동적 타입(DynamicObject)을 동일한 인터페이스로 다루면서, Scope를 통해 컴파일 타임에 잘못된 API 호출을 방지한다.

## Resource trait 해부

```rust
pub trait Resource {
    type DynamicType;
    type Scope;

    fn kind(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn group(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn version(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn plural(dt: &Self::DynamicType) -> Cow<'_, str>;
    fn meta(&self) -> &ObjectMeta;
    fn meta_mut(&mut self) -> &mut ObjectMeta;
    // ...
}
```

<!--
두 가지 핵심 연관 타입:
- DynamicType: 정적 타입(k8s-openapi)은 (), 동적 타입은 ApiResource
  - ()인 경우: kind/group/version이 타입 자체에 내장 → 런타임 비용 0
  - ApiResource인 경우: 런타임에 GVK 정보를 들고 다님
- Scope: NamespaceResourceScope, ClusterResourceScope, DynamicResourceScope
-->

## blanket impl — k8s-openapi 자동 연결

<!--
impl<K> Resource for K
where K: k8s_openapi::Metadata<Ty = ObjectMeta> + k8s_openapi::Resource

- k8s-openapi의 모든 타입(Pod, Deployment 등)이 자동으로 kube Resource 구현
- 사용자가 impl 작성할 필요 없음
- DynamicType = () (모든 정보가 타입에 내장)
- 이 blanket impl이 두 크레이트(k8s-openapi와 kube-core)를 연결하는 다리
-->

## Scope — 컴파일 타임 안전성

<!--
Api::namespaced()는 K: Resource<Scope = NamespaceResourceScope> 요구
→ Namespace(클러스터 스코프)를 Api::namespaced()로 만들면 컴파일 에러

Api::all()은 모든 Scope 허용

DynamicResourceScope: DynamicObject용, 런타임에 판단
→ Api::namespaced_with()는 컴파일 타임 검증 없음

예시 코드:
- Api::namespaced(client, "default") — Pod(네임스페이스 스코프) ✓
- Api::namespaced(client, "default") — Node(클러스터 스코프) ✗ 컴파일 에러
- Api::all(client) — 모두 가능
-->

## DynamicType 활용

<!--
세 가지 패턴:

1. 정적 (DynamicType = ()):
   Pod, Deployment 등 k8s-openapi 타입
   Api::<Pod>::namespaced(client, "ns") — 타입에 모든 정보 내장

2. 동적 (DynamicType = ApiResource):
   DynamicObject — 런타임에 GVK 결정
   let ar = ApiResource::from_gvk(&gvk);
   Api::<DynamicObject>::namespaced_with(client, "ns", &ar)

3. 반동적 (Object<P, U>):
   spec/status 구조는 알지만 GVK는 런타임에
   type MyObj = Object<MySpec, MyStatus>;
-->

## ResourceExt — 편의 메서드

<!--
blanket impl for all Resource:
- name_any(): name 또는 generateName 반환
- name_unchecked(): name.unwrap() — 없으면 패닉
- namespace(): Option<String>
- labels(), labels_mut(), annotations(), annotations_mut()
- finalizers(), finalizers_mut()
- owner_references(), owner_references_mut()
- uid(): Option<String>
- resource_version(): Option<String>
-->

## ObjectRef — 리소스 참조

<!--
pub struct ObjectRef<K: Lookup> {
    pub name: String,
    pub namespace: Option<String>,
    pub dyntype: K::DynamicType,
    pub extra: Extra, // resource_version, uid
}

- Hash/Eq는 name + namespace만 비교 (resourceVersion/uid 무시)
- Controller의 scheduler가 이것으로 중복 제거
- .erase() → ObjectRef<DynamicObject>로 타입 지움
- trigger_owners, trigger_others에서 핵심 역할
-->

---
sidebar_position: 4
title: "서드파티 CRD"
description: "내가 만들지 않은 CRD와 상호작용하는 방법 — DynamicObject, 직접 정의, kopium"
---

# 서드파티 CRD

Istio VirtualService, Cert-Manager Certificate 같이 내가 만들지 않은 CRD를 kube에서 다루는 방법은 여러 가지다. 각 방법의 트레이드오프를 이해하고 상황에 맞게 선택한다.

## ⚠️ 흔한 혼동

<!--
#[derive(CustomResource)]는 CRD를 **정의**하는 용도:
- CRD YAML 생성 (Document::crd())
- Kubernetes에 새 리소스 타입 등록

이미 존재하는 CRD를 **소비**할 때는 아래 3가지 방법 사용:
→ "Istio VirtualService를 읽고 싶다" ≠ "새 CRD를 만들고 싶다"
-->

## 방법 1: DynamicObject

<!--
가장 빠르게 시작. 타입 정의 불필요.

let gvk = GroupVersionKind::gvk("networking.istio.io", "v1", "VirtualService");
let ar = ApiResource::from_gvk(&gvk);
let api = Api::<DynamicObject>::namespaced_with(client, "ns", &ar);

let vs = api.get("my-virtualservice").await?;
let hosts = vs.data["spec"]["hosts"].as_array();

장점: 코드 0줄로 시작
단점: 모든 필드 접근이 serde_json::Value → 런타임 에러 위험, IDE 자동완성 없음

적합: 빠른 프로토타이핑, 필드 몇 개만 읽을 때
-->

## 방법 2: 직접 struct 정의

<!--
타입 안전하게 사용. struct + Resource impl.

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VirtualServiceSpec {
    pub hosts: Vec<String>,
    pub http: Vec<HttpRoute>,
}

// Object<Spec, Status>로 감싸기
type VirtualService = Object<VirtualServiceSpec, NotUsed>;

// 또는 #[derive(Resource)]로
#[derive(Resource, Clone, Debug, Serialize, Deserialize)]
#[resource(inherit = ...)] // 적절한 기존 타입이 있을 때

장점: 타입 안전, IDE 자동완성
단점: 업스트림 CRD 스키마 변경에 수동 대응, 전체 스키마를 정의해야 함

적합: 안정적인 CRD를 장기적으로 사용할 때
-->

## 방법 3: kopium

<!--
CRD YAML에서 Rust struct 자동 생성.

kopium -f virtualservice-crd.yaml --schema=derived > src/virtualservice.rs

생성 결과:
#[derive(CustomResource, Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[kube(group = "networking.istio.io", version = "v1", kind = "VirtualService")]
pub struct VirtualServiceSpec { ... }

장점: 수동 타입 정의 불필요, 스키마에서 자동 생성
단점: kopium 도구 설치 필요, 생성 코드를 직접 관리해야 함

자동화: build.rs에서 kopium 호출 → 빌드 시 자동 갱신
-->

## Discovery API

<!--
런타임에 클러스터의 리소스 정보 조회:

let discovery = Discovery::new(client.clone()).run().await?;

// 그룹 탐색
for group in discovery.groups() {
    for (ar, caps) in group.recommended_resources() {
        println!("{}/{}", ar.group, ar.kind);
    }
}

// 특정 GVK 해결
let (ar, caps) = discovery.resolve_gvk(&gvk)?;
let api = Api::<DynamicObject>::all_with(client, &ar);

사용 사례:
- 클러스터에 어떤 CRD가 설치되어 있는지 확인
- GVK → ApiResource 변환 (URL path, scope 등)
- kubectl api-resources 같은 도구 구현
-->

## 비교 정리

<!--
| 방법 | 타입 안전 | 설정 비용 | 유지보수 | 적합한 상황 |
|------|----------|----------|---------|------------|
| DynamicObject | ✗ | 없음 | 없음 | 프로토타입, 필드 몇 개만 |
| 직접 struct | ✓ | 높음 | 수동 | 안정적 CRD, 장기 사용 |
| kopium | ✓ | 중간 | 재생성 | 복잡한 CRD, 자동화 가능 |
| Discovery + Dynamic | ✗ | 없음 | 없음 | 런타임에 리소스 타입 결정 |
-->

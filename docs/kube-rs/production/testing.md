---
sidebar_position: 2
title: "테스트"
description: "단위 테스트, mock(tower-test), 통합 테스트(k3d), E2E"
---

# 테스트

컨트롤러를 어떻게 테스트하는지, 단위 테스트부터 실제 클러스터를 사용하는 E2E까지 단계별로 다룹니다.

## 단위 테스트

reconciler를 순수 함수에 가깝게 유지하면 API 호출 없이 로직을 검증할 수 있습니다. 핵심은 상태 계산 로직과 API 호출을 분리하는 것입니다.

```rust
// 로직만 분리
fn desired_configmap(obj: &MyResource) -> ConfigMap {
    ConfigMap {
        metadata: ObjectMeta {
            name: Some(format!("{}-config", obj.name_any())),
            namespace: obj.namespace(),
            owner_references: Some(vec![obj.controller_owner_ref(&()).unwrap()]),
            ..Default::default()
        },
        data: Some(BTreeMap::from([
            ("key".into(), obj.spec.value.clone()),
        ])),
        ..Default::default()
    }
}

#[test]
fn test_desired_configmap_name() {
    let obj = MyResource::new("test", MySpec { value: "hello".into() });
    let cm = desired_configmap(&obj);
    assert_eq!(cm.metadata.name.unwrap(), "test-config");
}

#[test]
fn test_desired_configmap_owner_ref() {
    let obj = MyResource::new("test", MySpec { value: "hello".into() });
    let cm = desired_configmap(&obj);
    let refs = cm.metadata.owner_references.unwrap();
    assert_eq!(refs.len(), 1);
    assert_eq!(refs[0].kind, "MyResource");
}
```

상태 결정 로직(어떤 ConfigMap을 만들어야 하는지), 에러 분류 로직(일시적 vs 영구적), 조건 판단 로직(reconcile이 필요한지) 등을 단위 테스트로 검증합니다.

## Mock 테스트 — tower-test

`tower_test::mock::pair()`로 가짜 HTTP 레이어를 만들어 Client에 주입합니다. 실제 Kubernetes 클러스터 없이 API 호출 시나리오를 테스트합니다.

### ApiServerVerifier 패턴

```rust
use tower_test::mock;
use kube::Client;
use http::{Request, Response};
use hyper::Body;

#[tokio::test]
async fn test_reconcile_creates_configmap() {
    let (mock_service, handle) = mock::pair::<Request<Body>, Response<Body>>();
    let mock_client = Client::new(mock_service, "default");

    // API 서버 역할을 하는 태스크
    let api_server = tokio::spawn(async move {
        // 첫 번째 요청: GET ConfigMap (404 → 없으므로 생성해야 함)
        let (request, send_response) = handle.next_request().await.unwrap();
        assert!(request.uri().path().contains("/configmaps/test-config"));
        send_response.send_response(
            Response::builder()
                .status(404)
                .body(Body::from(serde_json::to_vec(&not_found_status()).unwrap()))
                .unwrap()
        );

        // 두 번째 요청: PATCH ConfigMap (생성)
        let (request, send_response) = handle.next_request().await.unwrap();
        assert_eq!(request.method(), http::Method::PATCH);
        send_response.send_response(
            Response::new(Body::from(serde_json::to_vec(&configmap()).unwrap()))
        );
    });

    let ctx = Arc::new(Context { client: mock_client });
    let obj = Arc::new(test_resource());
    let result = reconcile(obj, ctx).await;
    assert!(result.is_ok());

    api_server.await.unwrap();
}
```

### 한계

| 한계 | 설명 |
|------|------|
| 순서 의존 | 요청 순서를 정확히 맞춰야 합니다. 순서가 바뀌면 테스트가 실패합니다 |
| 설정 장황 | 다중 요청 시나리오에서 mock 설정 코드가 길어집니다 |
| watcher mock | watcher 스트림을 mock하려면 추가 설정이 필요합니다 |

mock 테스트는 reconciler가 올바른 API 호출을 하는지 검증할 때 유용합니다. 하지만 복잡한 시나리오에서는 통합 테스트가 더 적합합니다.

## 통합 테스트 — k3d

실제 Kubernetes 클러스터에서 컨트롤러를 실행하고 결과를 검증합니다. [k3d](https://k3d.io)는 가벼운 Kubernetes 클러스터를 로컬에서 실행합니다.

### 클러스터 준비

```bash
# k3d 클러스터 생성 (로드밸런서 불필요)
k3d cluster create test --no-lb

# CRD 등록
kubectl apply -f manifests/crd.yaml
```

### 테스트 코드

```rust
#[tokio::test]
#[ignore] // CI에서만 실행
async fn test_reconcile_creates_resources() {
    let client = Client::try_default().await.unwrap();
    let api = Api::<MyResource>::namespaced(client.clone(), "default");

    // 리소스 생성
    api.create(&PostParams::default(), &test_resource()).await.unwrap();

    // 상태 수렴 대기
    let cond = await_condition(api.clone(), "test", |obj: Option<&MyResource>| {
        obj.and_then(|o| o.status.as_ref())
           .map(|s| s.phase == "Ready")
           .unwrap_or(false)
    });
    tokio::time::timeout(Duration::from_secs(30), cond)
        .await
        .expect("timeout waiting for Ready")
        .expect("watch error");

    // 자식 리소스 확인
    let cm_api = Api::<ConfigMap>::namespaced(client, "default");
    let cm = cm_api.get("test-config").await.expect("ConfigMap not found");
    assert_eq!(cm.data.unwrap()["key"], "expected-value");

    // 정리
    api.delete("test", &DeleteParams::default()).await.unwrap();
}
```

`await_condition()`은 watch 스트림을 열고 조건이 만족될 때까지 대기합니다. `tokio::time::timeout()`으로 감싸서 무한 대기를 방지합니다.

### CI 설정 (GitHub Actions)

```yaml title=".github/workflows/integration.yml"
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: AbsaOSS/k3d-action@v2
        with:
          cluster-name: test
      - run: kubectl apply -f manifests/crd.yaml
      - run: cargo test --test integration -- --ignored
```

## E2E 테스트

컨트롤러를 Docker 이미지로 빌드하고 실제로 배포한 뒤 동작을 검증합니다. 통합 테스트와 달리 컨트롤러가 프로세스 내부가 아닌 Pod로 실행됩니다.

```bash
# 1. 이미지 빌드
docker build -t my-controller:test .

# 2. k3d 클러스터에 이미지 로드
k3d image import my-controller:test -c test

# 3. 컨트롤러 배포
kubectl apply -f manifests/deployment.yaml

# 4. 컨트롤러 준비 대기
kubectl wait --for=condition=available deployment/my-controller --timeout=60s

# 5. 테스트 리소스 적용
kubectl apply -f test-fixtures/

# 6. 상태 수렴 확인
kubectl wait --for=jsonpath='.status.phase'=Ready myresource/test --timeout=60s
```

E2E 테스트는 RBAC, 리소스 제한, health probe, graceful shutdown 등 배포 환경에서만 검증 가능한 항목을 확인합니다.

## 비교 정리

| 단계 | 속도 | 필요 환경 | 검증 범위 |
|------|------|----------|----------|
| 단위 | 밀리초 | 없음 | 상태 계산 로직 |
| Mock | 초 | 없음 | API 호출 시나리오 |
| 통합 | 분 | k3d | reconcile 흐름, CRD 등록 |
| E2E | 분 | k3d + Docker | RBAC, 배포, 전체 시스템 |

단위 테스트를 가장 많이 작성하고, mock과 통합 테스트로 핵심 시나리오를 검증하며, E2E는 배포 파이프라인에서만 실행하는 피라미드 구조가 일반적입니다.

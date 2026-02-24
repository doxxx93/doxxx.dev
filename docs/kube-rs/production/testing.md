---
sidebar_position: 2
title: "테스트"
description: "단위 테스트, mock(tower-test), 통합 테스트(k3d), E2E"
---

# 테스트

컨트롤러를 어떻게 테스트하는지 — 단위 테스트부터 실제 클러스터를 사용하는 E2E까지 단계별로 다룬다.

## 단위 테스트

<!--
reconciler를 순수 함수처럼 테스트:

1. reconciler 로직을 Api 호출과 분리
   - reconcile_logic(obj, current_state) -> Vec<DesiredAction>
   - apply_actions(api, actions) 별도 함수

2. Context에 mock 주입
   - Client 없이 로직만 테스트
   - 상태 계산이 올바른지 검증

예:
#[test]
fn test_reconcile_creates_configmap_when_missing() {
    let obj = MyResource { spec: MySpec { name: "test".into() } };
    let actions = reconcile_logic(&obj, &CurrentState::default());
    assert!(actions.contains(&DesiredAction::CreateConfigMap("test-cm")));
}
-->

## Mock 테스트 — tower-test

<!--
ApiServerVerifier 패턴:
- tower_test::mock::pair()로 가짜 HTTP 레이어 생성
- 요청을 가로채서 예상 응답 반환

let (mock_service, handle) = tower_test::mock::pair();
let mock_client = Client::new(mock_service, "default");

tokio::spawn(async move {
    // 첫 번째 요청: GET Pod
    let (request, send_response) = handle.next_request().await.unwrap();
    assert_eq!(request.uri().path(), "/api/v1/namespaces/default/pods/my-pod");
    send_response.send_response(Response::new(Body::from(
        serde_json::to_vec(&pod).unwrap()
    )));

    // 두 번째 요청: PATCH status
    let (request, send_response) = handle.next_request().await.unwrap();
    // ...
});

한계:
- 다중 요청 시나리오 설정이 장황
- 요청 순서를 정확히 맞춰야 함
- watcher 스트림 mock은 더 복잡
-->

## 통합 테스트 — k3d

<!--
실제 Kubernetes 클러스터에서 테스트:

1. k3d 클러스터 생성:
   k3d cluster create test --no-lb

2. CRD 등록:
   kubectl apply -f manifests/crd.yaml

3. 테스트:
   #[tokio::test]
   async fn test_reconcile_creates_resources() {
       let client = Client::try_default().await.unwrap();
       let api = Api::<MyResource>::namespaced(client.clone(), "default");

       // 리소스 생성
       api.create(&PostParams::default(), &test_resource()).await.unwrap();

       // 상태 수렴 대기
       let cond = await_condition(api.clone(), "test", |obj| {
           obj.status.as_ref().map(|s| s.phase == "Ready").unwrap_or(false)
       });
       tokio::time::timeout(Duration::from_secs(30), cond).await.unwrap().unwrap();

       // 자식 리소스 확인
       let cm_api = Api::<ConfigMap>::namespaced(client, "default");
       assert!(cm_api.get("test-cm").await.is_ok());
   }

CI (GitHub Actions):
- uses: AbsaOSS/k3d-action@v2
  with:
    cluster-name: test
- run: cargo test --test integration
-->

## E2E 테스트

<!--
Docker 이미지로 빌드 + 실제 배포:

1. docker build -t my-controller:test .
2. k3d image import my-controller:test -c test
3. kubectl apply -f manifests/deployment.yaml
4. kubectl wait --for=condition=available deployment/my-controller
5. kubectl apply -f test-fixtures/
6. kubectl wait --for=jsonpath='.status.phase'=Ready myresource/test

단위 → mock → 통합 → E2E 피라미드:
- 단위: 빠름, 로직 검증
- mock: API 상호작용 검증, 클러스터 불필요
- 통합: 실제 API 서버, CRD 등록, reconcile 흐름
- E2E: 컨테이너 이미지, 배포, 전체 시스템
-->

## 비교 정리

<!--
| 단계 | 속도 | 필요 환경 | 검증 범위 |
|------|------|----------|----------|
| 단위 | 밀리초 | 없음 | 로직 |
| Mock | 초 | 없음 | API 상호작용 |
| 통합 | 분 | k3d | reconcile 흐름 |
| E2E | 분 | k3d + Docker | 전체 시스템 |
-->

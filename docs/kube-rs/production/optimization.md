---
sidebar_position: 3
title: "최적화"
description: "watcher, reflector, reconciler 각 단계에서의 성능 최적화"
---

# 최적화

대규모 클러스터에서 컨트롤러가 효율적으로 동작하도록 각 레이어별 최적화 방법을 다룹니다.

## Watcher 최적화

<!--
1. 감시 범위 축소:
   watcher::Config::default()
       .labels("app=myapp")       // label selector
       .fields("metadata.name=specific") // field selector
   → API 서버가 필터링 → 네트워크/메모리 절약

2. metadata_watcher():
   metadata_watcher(api, wc) 대신 watcher(api, wc)
   → PartialObjectMeta만 수신 (spec/status 제외)
   → 메모리 대폭 절약 (큰 spec을 가진 리소스에서 효과적)
   → 단, reconciler에서 전체 객체가 필요하면 별도 get() 호출 필요

3. StreamingList:
   watcher::Config::default().streaming_lists()
   → 초기 목록 로드 시 한 번에 하나씩 처리
   → LIST보다 메모리 피크 낮음
   → K8s 1.27+ 필요

4. page_size 조절:
   기본 500 (client-go 동일)
   → 소규모 클러스터: 더 크게 → API 호출 수 감소
   → 대규모 클러스터: 더 작게 → 메모리 피크 감소
-->

## Reflector 최적화

<!--
1. 불필요한 필드 제거:
   watcher(api, wc)
       .default_backoff()
       .modify(|obj| {
           obj.managed_fields_mut().clear();
           obj.annotations_mut().remove("kubectl.kubernetes.io/last-applied-configuration");
       })
   → managedFields만 제거해도 상당한 메모리 절약
   → last-applied-configuration annotation도 크기가 큼

2. 메모리 프로파일링:
   - jemalloc + MALLOC_CONF="prof:true" 으로 힙 프로파일링
   - Store에 캐시된 객체 수 × 평균 크기 = 예상 메모리
   - re-list 시 일시적 2~3배 스파이크 고려
-->

## Reconciler 최적화

<!--
1. 자기 trigger 방지 (predicate_filter):
   controller 생성 시:
   Controller::new(api, wc)
       .with_config(Config::default().debounce(Duration::from_secs(1)))

   또는 스트림 레벨에서:
   .applied_objects()
   .predicate_filter(predicates::generation)
   → status만 변경된 이벤트 무시
   → 무한 루프 방지 + 불필요한 reconcile 감소

2. debounce:
   Config::default().debounce(Duration::from_secs(1))
   → 1초 이내 동일 객체에 대한 중복 trigger 무시
   → burst 흡수 (예: Deployment 업데이트 시 여러 ReplicaSet 이벤트)

3. concurrency 제한:
   Config::default().concurrency(10)
   → 최대 10개 동시 reconcile
   → API 서버 부하 제어
   → 0 = 무제한 (기본)

4. reconciler 내부:
   - 변경 필요 없으면 patch 건너뛰기
   - get() 대신 Store에서 읽기 (이미 캐시됨)
   - 여러 API 호출을 tokio::try_join!으로 병렬화
-->

## 대규모 클러스터 고려사항

<!--
1. 네임스페이스 분리:
   - 클러스터 전체 대신 특정 네임스페이스만 watch
   - Api::namespaced() + watcher::Config에 namespace 지정
   - 필요하면 네임스페이스별 Controller 인스턴스

2. re-list 메모리 스파이크:
   - 10,000개 객체 × 평균 10KB = 100MB 기본
   - re-list 시 old + new + buffer = 최대 300MB 일시적
   - StreamingList로 완화
   - metadata_watcher로 객체 크기 축소

3. API 서버 부하:
   - owns/watches가 많으면 watcher 수 증가
   - 각 watcher가 별도 watch 연결 유지
   - 가능하면 shared reflector (unstable-runtime feature)

4. Leader election (미내장):
   - HA 배포 시 하나의 인스턴스만 active
   - Lease 객체로 직접 구현 또는 외부 크레이트
   - kube-rs에 내장 계획 있지만 아직 미구현
-->

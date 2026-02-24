# kube-rs 문서 초안

> 이 파일은 각 페이지별 세부 목차와 담을 내용을 정리한 청사진입니다.
> 확정 후 삭제합니다.

---

## 전체 구조

```
docs/kube-rs/
├── index.md
├── architecture/
│   ├── crate-overview.md
│   ├── resource-type-system.md
│   ├── client-and-tower-stack.md
│   └── request-lifecycle.md
├── runtime-internals/
│   ├── watcher.md
│   ├── reflector-and-store.md
│   ├── controller-pipeline.md
│   └── custom-resources.md
├── patterns/
│   ├── reconciler.md
│   ├── relations-and-finalizers.md
│   ├── server-side-apply.md
│   ├── third-party-crds.md
│   └── error-handling-and-backoff.md
└── production/
    ├── observability.md
    ├── testing.md
    └── optimization.md
```

---

## index.md — 도입

**목적**: 이 문서 전체의 취지와 대상 독자를 명시. kube-rs가 뭔지 한 문단 소개 후 바로 목차로.

### 내용

- kube-rs 한 줄 소개 (CNCF Sandbox, Rust Kubernetes client)
- 이 문서의 대상: "kube를 쓰고 있지만 내부를 제대로 이해하고 싶은 사람"
- 전제 조건: Rust 기본, Kubernetes 기본 개념(Pod, Deployment, CRD 등)
- 각 섹션 요약 테이블
  | 섹션 | 다루는 내용 |
  | architecture | 크레이트 구조, 타입 시스템, 클라이언트 내부 |
  | runtime-internals | watcher/reflector/controller 동작 원리 |
  | patterns | 올바른 사용 패턴과 흔한 실수 |
  | production | 모니터링, 테스트, 최적화 |
- Cargo.toml 기본 셋업 (kube + k8s-openapi + tokio)
- 참고 링크 (kube.rs, docs.rs, GitHub)

---

## architecture/ — "kube-rs는 어떻게 생겼는가"

### crate-overview.md — 크레이트 구조

**목적**: 5개 크레이트의 역할, 계층, 의존 관계를 명확히.

### 내용

1. **왜 여러 크레이트로 나뉘었는가**
   - 관심사 분리: core(타입) vs client(네트워크) vs runtime(추상화)
   - 최소 의존성 원칙: kube-core는 HTTP 의존성 없음 → 라이브러리에서 타입만 쓸 수 있음
   - feature flag로 선택적 활성화

2. **계층 다이어그램** (mermaid)
   ```
   kube (facade) → kube-client → kube-core
                 → kube-runtime → kube-core
                 → kube-derive → kube-core
   ```

3. **각 크레이트 역할 요약**
   - kube-core: Resource trait, ObjectMeta, API 파라미터, Patch 타입 등 "HTTP 없는 순수 타입"
   - kube-client: Client(Tower 기반), Api<K>, Config, Discovery
   - kube-runtime: watcher, reflector, Controller, finalizer, scheduler
   - kube-derive: #[derive(CustomResource)], #[derive(Resource)], #[derive(KubeSchema)]
   - kube: facade — feature flag에 따라 위 4개를 re-export

4. **Go 생태계와 대응 관계**
   | kube-rs | Go |
   | kube-core | k8s.io/apimachinery |
   | kube-client | client-go |
   | kube-runtime | controller-runtime |
   | kube-derive | kubebuilder (코드 생성) |

5. **feature flag 조합 가이드**
   - API 조회만: `kube` (기본)
   - 컨트롤러: `kube = { features = ["runtime", "derive"] }`
   - Pod exec: 추가로 `"ws"`
   - 최소 타입만: `kube-core` 직접 의존

6. **k8s-openapi의 위치**
   - Kubernetes API 타입 정의 (Pod, Deployment 등)
   - version feature flag (`latest`, `v1_30`)
   - kube-core가 k8s-openapi의 Resource trait에 blanket impl 제공

---

### resource-type-system.md — Resource trait과 타입 시스템

**목적**: kube-rs의 타입 안전성이 어떻게 작동하는지. 컴파일 타임에 뭘 보장하는지.

### 내용

1. **Resource trait 해부**
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
   - `DynamicType`: 정적 타입(k8s-openapi)은 `()`, 동적 타입은 `ApiResource`
   - `Scope`: `NamespaceResourceScope`, `ClusterResourceScope`, `DynamicResourceScope`

2. **blanket impl의 마법**
   - `impl<K> Resource for K where K: k8s_openapi::Metadata + k8s_openapi::Resource`
   - k8s-openapi의 모든 타입이 자동으로 kube의 Resource가 됨
   - 사용자는 impl 안 해도 됨

3. **Scope로 컴파일 타임 안전성**
   - `Api::namespaced()` — `K: Resource<Scope = NamespaceResourceScope>` 요구
   - Namespace(클러스터 스코프)를 `Api::namespaced()`로 만들면 → 컴파일 에러
   - `Api::all()` — 모든 스코프 허용
   - `DynamicResourceScope` — 동적 타입용, 런타임에 판단

4. **DynamicType 활용**
   - 정적: `Pod`의 `DynamicType = ()` → 메타데이터가 타입에 내장
   - 동적: `DynamicObject`의 `DynamicType = ApiResource` → 런타임에 GVK 지정
   - `Object<P, U>` — spec/status 구조를 알지만 GVK는 런타임에 결정할 때

5. **ResourceExt 편의 메서드**
   - name_any(), namespace(), labels(), annotations(), finalizers() 등
   - 왜 `name_unchecked()`와 `name_any()`가 따로 있는지

6. **ObjectRef — 리소스 참조의 표준형**
   - Hash/Eq에서 name+namespace만 비교 (resourceVersion, uid 무시)
   - `.erase()` — 타입을 지워서 `ObjectRef<DynamicObject>`로 변환
   - Controller의 trigger_owners에서 핵심 역할

---

### client-and-tower-stack.md — Client 내부 구조

**목적**: Client가 실제로 어떻게 HTTP 요청을 보내는지. Tower 미들웨어 아키텍처.

### 내용

1. **Client의 실체**
   ```rust
   pub struct Client {
       inner: Buffer<BoxService<Request<Body>, Response<Body>, BoxError>>,
       default_ns: String,
   }
   ```
   - `tower::Buffer`로 감싸진 type-erased Service
   - Clone이 가벼운 이유: Buffer 내부가 Arc → 여러 Api 핸들에서 공유 가능
   - capacity 1024로 동시 요청 제한

2. **Tower 미들웨어 스택** (아래서 위로 쌓이는 레이어)
   ```
   [사용자 코드]
        ↓
   TraceLayer              — OpenTelemetry 호환 HTTP 스팬
   extra_headers_layer     — impersonation 등 커스텀 헤더
   auth_layer              — Bearer 토큰, exec 기반 인증, 토큰 갱신
   DecompressionLayer      — gzip 응답 해제 (feature: gzip)
   base_uri_layer          — cluster_url prefix 추가
   hyper Client            — HTTP/1.1 + HTTP/2 실제 전송
   TimeoutConnector        — connect/read/write 타임아웃
   TLS layer               — rustls 또는 openssl
   Proxy                   — SOCKS5/HTTP 프록시 (선택)
   HttpConnector           — TCP 연결
   ```
   - 각 레이어가 하는 일을 한 줄씩 설명

3. **Config 추론 체인**
   - `Client::try_default()` → `Config::infer()`
   - 순서: kubeconfig (`$KUBECONFIG` or `~/.kube/config`) → in-cluster (`/var/run/secrets/...`) → env vars
   - 기본 타임아웃: connect=30s, read=295s, write=295s
   - ⚠️ read_timeout 295초 함정: watch용이지만 일반 GET/PUT에도 적용됨

4. **인증 처리**
   - 정적 토큰, 인증서, exec plugin (AWS EKS 등)
   - 토큰 갱신: auth_layer가 만료 전 자동 refresh
   - ⚠️ watcher 재연결 시 credentials rotation 문제 (알려진 한계)

5. **Client를 직접 커스텀하는 경우**
   - `ClientBuilder` — 미들웨어 추가/교체
   - 별도 Client 인스턴스 패턴: watcher용(긴 timeout) vs API 호출용(짧은 timeout)

---

### request-lifecycle.md — 요청의 여정

**목적**: `pods.list()` 한 줄이 실제로 어떤 코드 경로를 거치는지 추적.

### 내용

1. **호출 코드**
   ```rust
   let pods: Api<Pod> = Api::default_namespaced(client);
   let list = pods.list(&ListParams::default()).await?;
   ```

2. **Api<K> 내부**
   - `Api<K>` 구조: `{ request: kube_core::Request, client: Client, namespace: Option<String> }`
   - `list()` → `self.request.list(&lp)` → `http::Request<Vec<u8>>` 생성
   - URL 조립: `/api/v1/namespaces/{ns}/pods?limit=...&labelSelector=...`

3. **kube-core::Request**
   - URL path + query parameter만 조립 (HTTP 레벨)
   - 실제 네트워크 전송 없음 — 순수 함수

4. **Client::request::<T>()**
   - `send()` → Tower 스택 통과 → `Response<Body>`
   - 상태 코드 확인: 4xx/5xx → `Status` 파싱 → `Error::Api`
   - 200 → `serde_json::from_slice::<T>()` → `ObjectList<Pod>`

5. **Watch 요청의 특수성**
   - `request_events::<T>()` → `AsyncBufRead` 스트림
   - `FramedRead` + `LinesCodec` — 줄 단위로 JSON 파싱
   - 각 줄이 `WatchEvent<K>` (Added/Modified/Deleted/Bookmark)
   - 왜 chunked transfer encoding인지, keep-alive와의 관계

6. **에러 처리 흐름**
   - `handle_api_errors()`: Response → Status 파싱
   - `Error::Api { status }` — Kubernetes가 보낸 구조화된 에러
   - 네트워크 에러 vs API 에러 구분

---

## runtime-internals/ — "런타임이 내부에서 뭘 하는가"

### watcher.md — Watcher 상태 머신

**목적**: watcher가 내부적으로 어떤 상태를 거치는지, 에러 시 어떻게 복구하는지.

### 내용

1. **watcher의 역할**
   - `Api::watch()`의 한계: 연결 끊기면 끝, resourceVersion 만료 대응 없음
   - watcher: 자동 재연결 + 초기 목록 로드 + 에러 복구를 감싼 Stream

2. **상태 머신 다이어그램** (mermaid)
   ```
   Empty → InitPage(ListWatch) 또는 InitialWatch(StreamingList)
       → InitListed
       → Watching
       → (410 Gone 또는 치명적 에러) → Empty로 복귀
   ```
   - 각 상태에서 어떤 API 호출을 하는지
   - 상태 전이 조건

3. **두 가지 초기 목록 전략**
   - **ListWatch** (기본): LIST (page_size=500) → 모든 페이지 소진 → WATCH
   - **StreamingList** (K8s 1.27+): WATCH + `sendInitialEvents=true` 한 번에
   - 선택 기준: 클러스터 버전, 리소스 수

4. **Event 추상화**
   ```rust
   pub enum Event<K> {
       Init,          // re-list 시작
       InitApply(K),  // 초기 목록의 각 객체
       InitDone,      // 초기 목록 완료
       Apply(K),      // watch 중 Added/Modified
       Delete(K),     // watch 중 Deleted
   }
   ```
   - vs Kubernetes의 `WatchEvent` (Added/Modified/Deleted/Bookmark)
   - Init/InitApply/InitDone이 왜 필요한지 (reflector의 atomic swap을 위해)

5. **에러 복구와 backoff**
   - 모든 watcher 에러는 재시도 가능으로 간주
   - `.default_backoff()`: 지수 백오프
   - ⚠️ backoff 없이 쓰면: 에러 시 스트림 종료 → 컨트롤러 멈춤
   - 410 Gone: resourceVersion 만료 → Empty로 돌아가 전체 re-list

6. **watcher::Config**
   - label/field selector, timeout, page_size
   - `ListSemantic`: MostRecent vs Any (consistency vs speed)
   - `InitialListStrategy`: ListWatch vs StreamingList
   - bookmarks 활성화 (기본 on)

7. **⚠️ 알아야 할 것들**
   - watch 이벤트는 전달 보장 안 됨 (네트워크 단절 시 DELETE 유실 가능)
   - re-list 시 메모리 스파이크 (대규모 클러스터에서)
   - bookmarks이 없으면 resourceVersion이 더 빨리 만료됨

---

### reflector-and-store.md — Reflector와 Store

**목적**: 캐싱이 어떻게 작동하는지. Store가 비동기인 이유.

### 내용

1. **reflector의 역할**
   - watcher 스트림을 가로채서 Store에 기록하는 "투명한 어댑터"
   - 스트림을 그대로 통과시키면서 사이드이펙트로 캐시 업데이트
   ```rust
   pub fn reflector<K, W>(writer: Writer<K>, stream: W) -> impl Stream<Item = W::Item>
   ```

2. **Store 내부 구조**
   ```rust
   type Cache<K> = Arc<RwLock<AHashMap<ObjectRef<K>, Arc<K>>>>;
   ```
   - `AHashMap`: std HashMap보다 빠름 (DoS 방어 필요 없는 내부 캐시)
   - `parking_lot::RwLock`: 읽기 동시성 최대화
   - `Arc<K>`: 객체를 여러 곳에서 공유

3. **Atomic swap 패턴** ← 핵심
   - `Init` 이벤트: 새 buffer HashMap 생성
   - `InitApply(obj)`: buffer에 insert
   - `InitDone`: `mem::swap(buffer, store)` → 이전 데이터 한번에 교체
   - `Apply(obj)`: store에 직접 insert
   - `Delete(obj)`: store에서 직접 remove
   - 왜 이렇게 하는가: re-list 중 store가 일관성 없는 상태가 되는 것을 방지

4. **Store의 비동기 특성**
   - Store는 생성 시 비어있음
   - watcher 스트림이 poll되어야 채워짐
   - `wait_until_ready()`: 첫 InitDone까지 대기 (DelayedInit 내부 사용)
   - ⚠️ 흔한 실수: Store 만들고 바로 `.state()` 호출 → 빈 결과

5. **Writer vs Store (읽기/쓰기 분리)**
   - `Writer<K>`: reflector가 소유, 쓰기 담당
   - `Store<K>`: Clone 가능, 읽기 전용 핸들
   - Controller가 자동으로 이 분리를 관리

6. **Shared/Subscriber 모드** (unstable)
   - `Writer::new_shared(buf_size)`: async_broadcast로 이벤트 팬아웃
   - 여러 Consumer가 같은 Store를 구독
   - 사용 사례: 하나의 watcher로 여러 컨트롤러에 이벤트 전달

---

### controller-pipeline.md — Controller 전체 파이프라인

**목적**: Controller::new()부터 reconciler 호출까지 전체 데이터 흐름.

### 내용

1. **전체 파이프라인 다이어그램** (mermaid 또는 ASCII)
   ```
   K8s API
     ↓
   watcher()              — 상태 머신, 에러 복구
     ↓
   reflector(writer, _)   — Store에 캐싱
     ↓
   .applied_objects()     — Event<K> → K 스트림
     ↓
   trigger_self()         — K → ReconcileRequest<K>
     ↓                      ┌── owns() → trigger_owners()
   select_all ◄────────────┤
     ↓                      └── watches() → trigger_others(mapper)
   debounced_scheduler()  — 중복 제거, 지연
     ↓
   Runner                 — 동시성 제어, hold_unless
     ↓
   reconciler(Arc<K>, ctx) — 사용자 코드
     ↓
   RescheduleReconciliation — Action → scheduler로 피드백
   ```

2. **Controller 구조체**
   ```rust
   pub struct Controller<K> {
       trigger_selector: SelectAll<...>,
       trigger_backoff: Box<dyn Backoff>,
       reader: Store<K>,
       config: Config, // debounce, concurrency
   }
   ```

3. **Trigger 시스템**
   - `trigger_self()`: 주 리소스 변경 → ReconcileRequest 생성
   - `trigger_owners()`: 자식 리소스 → ownerReferences 추적 → 부모의 ReconcileRequest
   - `trigger_others(mapper)`: 관련 리소스 → 사용자 정의 매핑 함수
   - `select_all`: 모든 trigger 스트림을 하나로 합침

4. **Scheduler의 중복 제거**
   - `DelayQueue` + `HashMap<ObjectRef, ScheduledEntry>`
   - 같은 객체에 대한 여러 trigger → 가장 이른 시간 하나만 유지
   - debounce: 설정된 기간 내 추가 trigger 무시
   - 왜 필요한가: status 업데이트 → watch 이벤트 → 불필요한 재reconcile 방지

5. **Runner의 동시성 제어**
   - `FutureHashMap<ObjectRef, Future>`: 활성 reconcile 작업 추적
   - `hold_unless(!slots.contains_key(msg))`: 이미 실행 중인 객체는 대기
   - `max_concurrent_executions`: 전체 동시 실행 제한
   - readiness gate: `Store::wait_until_ready()` 후에만 reconcile 시작

6. **Reconcile 결과 처리**
   - 성공: `Action::requeue(Duration)` → scheduler에 예약
   - `Action::await_change()` → 다음 watch 이벤트까지 대기
   - 실패: `error_policy(obj, err, ctx)` → Action 반환 → scheduler에 예약

7. **Shutdown**
   - `graceful_shutdown_on(future)`: 새 reconcile 중단, 진행 중인 것은 완료 대기
   - `shutdown_on_signal()`: SIGTERM/SIGINT 처리

---

### custom-resources.md — CRD와 derive 매크로

**목적**: #[derive(CustomResource)]가 실제로 무슨 코드를 생성하는지.

### 내용

1. **입력 코드**
   ```rust
   #[derive(CustomResource, Clone, Debug, Serialize, Deserialize, JsonSchema)]
   #[kube(group = "example.com", version = "v1", kind = "Document")]
   #[kube(namespaced, status = "DocumentStatus")]
   pub struct DocumentSpec {
       pub title: String,
       pub content: String,
   }
   ```

2. **생성되는 코드** (실제 확장 결과)
   - `Document` 구조체: `{ metadata: ObjectMeta, spec: DocumentSpec, status: Option<DocumentStatus> }`
   - `impl Resource for Document` — kind(), group(), version(), plural(), meta() 등
   - `impl CustomResourceExt for Document` — `fn crd() -> CustomResourceDefinition`
   - `impl HasSpec for Document`
   - `fn new(name: &str, spec: DocumentSpec) -> Self`

3. **스키마 생성 과정**
   - `JsonSchema` derive (schemars) → OpenAPI v3 스키마
   - kube-derive가 스키마를 CRD의 `.spec.versions[].schema` 필드에 삽입
   - `#[schemars(...)]` 어트리뷰트로 스키마 커스텀

4. **주요 #[kube(...)] 어트리뷰트 가이드**
   - 필수: group, version, kind
   - 스코프: namespaced (없으면 클러스터 스코프)
   - 상태: status = "StatusType"
   - 스케일: scale(spec_replicas_path, ...)
   - 출력 컬럼: printcolumn
   - CEL 검증: validation = Rule::new("self.spec.replicas > 0")
   - 여러 버전: storage, served, deprecated

5. **⚠️ 스키마 관련 함정들**
   - `#[serde(untagged)]` enum → Kubernetes가 거부할 수 있는 스키마 생성
   - `Option<MyEnum>` + doc comment → anyOf 안에 description이 들어가는 버그 (v3.0.0)
   - `#[serde(flatten)] HashMap` → 유효하지 않은 OpenAPI 스키마
   - 해결: `#[schemars(schema_with = "...")]`로 수동 스키마 지정

6. **CRD 등록**
   ```rust
   let crds = Document::crd();
   let crd_api: Api<CustomResourceDefinition> = Api::all(client);
   crd_api.patch("documents.example.com", &ssapply, &Patch::Apply(crds)).await?;
   ```

---

## patterns/ — "제대로 쓰는 법"

### reconciler.md — Reconciler 작성 패턴

**목적**: idempotent reconciler를 어떻게 작성하는지. 흔한 실수와 올바른 패턴.

### 내용

1. **reconciler 함수 시그니처**
   ```rust
   async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error>
   ```
   - `Arc<K>`: Store에서 꺼낸 참조 (clone 없이 공유)
   - `Context`: 의존성 주입 (Client, 설정 등)
   - 반환: `Action::requeue(duration)` 또는 `Action::await_change()`

2. **핵심 원칙: Idempotency**
   - "현재 상태를 보고 원하는 상태로 수렴" — trigger reason에 의존하지 않음
   - 왜 trigger reason을 안 주는가: 설계 철학 (level-triggered vs edge-triggered)
   - 같은 reconcile을 100번 호출해도 결과가 같아야 함

3. **⚠️ 무한 루프 패턴과 방지법**
   - 패턴: status에 `last_updated: Utc::now()` → 새 resourceVersion → 재trigger → 무한반복
   - 방지: 결정론적 값만 쓰기, 또는 값이 같으면 patch 건너뛰기
   - `predicate_filter(predicates::generation)`: status 변경은 generation 안 바뀜 → 필터링
   - ⚠️ finalizer + generation predicate 조합 주의: finalizer 추가는 generation 안 바뀜 → `predicates::finalizers` fallback 필요

4. **Action 전략**
   - `Action::requeue(Duration::from_secs(300))`: 주기적 재확인 (외부 상태 의존 시)
   - `Action::await_change()`: watch 이벤트가 올 때만 재실행 (자기 리소스만 볼 때)
   - error_policy에서 backoff 전략: 고정 간격 vs 지수 증가

5. **Context를 통한 의존성 주입**
   ```rust
   struct Context {
       client: Client,
       metrics: Metrics,
       config: AppConfig,
   }
   ```
   - Client, 메트릭, 외부 클라이언트 등을 Context에 담기
   - reconciler를 순수 함수에 가깝게 유지

6. **에러 처리 패턴**
   - `thiserror`로 구체적 에러 타입 (anyhow는 Controller 바운드와 안 맞음)
   - 일시적 에러 vs 영구적 에러 구분
   - 영구적 에러: status에 condition 기록 후 Action::await_change()
   - 일시적 에러: error_policy에서 requeue

---

### relations-and-finalizers.md — 관계와 정리

**목적**: ownerReferences, watches, finalizer의 동작 원리와 올바른 사용법.

### 내용

1. **소유 관계 (owns)**
   - `controller.owns::<ConfigMap>(api, wc)` — 자식 리소스 감시
   - 내부: `trigger_owners()` — 자식의 `ownerReferences`에서 부모 ObjectRef 추출
   - ownerReference 설정법: `controller_owner_ref()` vs `owner_ref()`
   - 자동 가비지 컬렉션: 부모 삭제 → Kubernetes가 자식 삭제

2. **감시 관계 (watches)**
   - `controller.watches::<Secret>(api, wc, mapper_fn)` — 관련 리소스 감시
   - mapper_fn: `|secret| -> Vec<ObjectRef<MyResource>>` — 어떤 부모를 reconcile할지 매핑
   - 사용 사례: Secret 변경 → 해당 Secret을 참조하는 모든 리소스 재reconcile

3. **Finalizer 상태 머신**
   ```
   (finalizer 없음, 삭제 중 아님) → finalizer 추가 (JSON Patch)
   (finalizer 있음, 삭제 중 아님) → Event::Apply → 정상 reconcile
   (finalizer 있음, 삭제 중)     → Event::Cleanup → 정리 후 finalizer 제거
   (finalizer 없음, 삭제 중)     → 아무것도 안 함 (이미 정리됨)
   ```
   - finalizer 제거 시 JSON Patch `Test` operation으로 동시성 안전 보장
   - 왜 finalizer가 필요한가: DELETE 이벤트는 신뢰할 수 없지만, finalizer는 삭제 전 반드시 호출됨

4. **사용 패턴**
   ```rust
   finalizer(&api, "myapp.example.com/cleanup", obj, |event| async {
       match event {
           Event::Apply(obj) => reconcile_normal(obj).await,
           Event::Cleanup(obj) => cleanup(obj).await,
       }
   }).await
   ```

5. **⚠️ 주의사항**
   - finalizer 이름은 도메인 형식 (e.g., `myapp.example.com/cleanup`)
   - cleanup이 실패하면 객체가 영원히 삭제 안 됨 (deletionTimestamp만 찍힘)
   - 클러스터 스코프 CR이 네임스페이스 스코프 자식을 owns할 때 ObjectRef 매칭 문제

---

### server-side-apply.md — Server-Side Apply

**목적**: SSA의 올바른 사용법과 흔한 실수.

### 내용

1. **왜 SSA인가**
   - Merge patch의 한계: 필드 충돌, 배열 처리 문제
   - SSA: 필드 소유권 기반 → 충돌 감지 → 안전한 다자 수정
   - reconciler에서 권장되는 기본 패턴

2. **기본 패턴**
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

3. **⚠️ 흔한 실수들**
   - `apiVersion`과 `kind` 누락 → 400 에러 (merge patch와 다름)
   - field manager 이름 안 넣음 → 기본값 사용 → 소유권 충돌
   - `force: true` 남용 → 다른 컨트롤러의 필드를 덮어씀

4. **Status patching**
   ```rust
   let status_patch = serde_json::json!({
       "apiVersion": "example.com/v1",
       "kind": "MyResource",
       "status": { "phase": "Ready", "conditions": [...] }
   });
   api.patch_status("name", &pp, &Patch::Apply(status_patch)).await?;
   ```
   - `/status` subresource를 통해야 함
   - 전체 객체 구조로 감싸야 함 (status만 보내면 안 됨)

5. **typed SSA 패턴**
   - `serde_json::json!()` 대신 Rust 타입을 사용
   - `..Default::default()`로 불필요한 필드 생략
   - 장단점: 타입 안전 vs 불필요한 필드가 patch에 포함될 수 있음

---

### third-party-crds.md — 서드파티 CRD 사용

**목적**: 내가 만들지 않은 CRD와 상호작용하는 방법들.

### 내용

1. **방법 1: DynamicObject**
   ```rust
   let gvk = ApiResource::from_gvk(&GroupVersionKind { ... });
   let api = Api::<DynamicObject>::namespaced_with(client, "ns", &gvk);
   let obj = api.get("my-obj").await?;
   let field = obj.data["spec"]["field"].as_str();
   ```
   - 장점: 타입 정의 불필요
   - 단점: 모든 필드 접근이 `serde_json::Value` → 런타임 에러

2. **방법 2: 직접 struct 정의**
   - k8s-openapi 스타일로 struct 정의 + `impl Resource`
   - 또는 `#[derive(Resource)]` + `#[resource(inherit = ...)]`
   - 장점: 타입 안전
   - 단점: 업스트림 CRD 스키마 변경에 수동 대응

3. **방법 3: Object<Spec, Status>**
   ```rust
   type IstioVirtualService = Object<VirtualServiceSpec, VirtualServiceStatus>;
   ```
   - 중간 지점: spec/status는 타입, metadata와 GVK는 동적

4. **⚠️ 흔한 혼동**
   - `#[derive(CustomResource)]`는 CRD를 **정의**하는 용도 (CRD YAML 생성)
   - 이미 존재하는 CRD를 **소비**할 때는 위 3가지 방법 사용
   - Discovery API로 런타임에 리소스 정보 조회: `Discovery::new(client).run().await`

5. **kopium — 자동 타입 생성**
   - CRD YAML → Rust struct 자동 변환 도구
   - `kopium -f crd.yaml --schema=derived`
   - 생성된 코드를 직접 관리하거나 build.rs에서 자동화

---

### error-handling-and-backoff.md — 에러 처리와 백오프

**목적**: 에러가 어디서 발생하고, 어떻게 처리해야 하는지.

### 내용

1. **에러 발생 지점 맵**
   ```
   Client::send() → 네트워크 에러, TLS 에러, 타임아웃
   Api::list()/get() → Error::Api (4xx/5xx → Status)
   watcher() → watcher::Error (InitialListFailed, WatchFailed, WatchError)
   reflector() → 동일 (watcher 에러 투과)
   Controller::run() → reconciler 에러 + watcher 에러
   ```

2. **watcher 에러 처리**
   - `watcher::Error`의 종류와 의미
   - `.default_backoff()`: 지수 백오프 (기본: 1s → 2s → 4s → ... → 60s)
   - 커스텀 백오프: `.backoff(ExponentialBackoff { ... })`
   - ⚠️ backoff 없으면: 첫 에러에 스트림 종료

3. **reconciler 에러 처리**
   - `error_policy(obj, err, ctx) -> Action`: 에러 시 requeue 전략
   - 현재 한계: error_policy는 동기 함수, 성공 시 reset 콜백 없음
   - per-key 백오프 패턴: reconciler를 wrapper로 감싸서 HashMap<ObjectRef, u32>로 실패 횟수 추적

4. **Client 레벨 재시도**
   - 현재 내장 없음 (watcher만 재시도)
   - tower::retry::Policy로 직접 구현하는 패턴
   - 어떤 에러가 재시도 가능한지: 5xx, 타임아웃, 네트워크 / 4xx는 보통 불가

5. **타임아웃 전략**
   - 기본 read_timeout=295s의 함정
   - watcher용 Client vs API 호출용 Client 분리 패턴
   - `tokio::time::timeout()`으로 개별 호출 감싸기

---

## production/ — "실전 운영"

### observability.md — 모니터링

**목적**: 로깅, 트레이싱, 메트릭 설정 가이드.

### 내용

1. **구조화된 로깅 (tracing)**
   - `tracing` + `tracing-subscriber` 기본 설정
   - Controller가 자동으로 추가하는 span: object name, namespace, reconcile reason
   - 로그 필터링: `RUST_LOG=kube=debug,my_controller=info`

2. **분산 트레이싱**
   - OpenTelemetry + OTLP exporter
   - Client의 TraceLayer → HTTP 요청에 자동 span
   - reconciler에서 span 연결

3. **메트릭**
   - Prometheus 메트릭 패턴 (tikv/rust-prometheus 또는 metrics crate)
   - 권장 메트릭: reconcile 횟수, 지속시간, 에러율, 큐 깊이
   - Controller 스트림에서 메트릭 수집하는 패턴

4. **health check**
   - readiness: Store가 ready인지 (`wait_until_ready()`)
   - liveness: reconcile 루프가 살아있는지

---

### testing.md — 테스트 전략

**목적**: 단위 테스트부터 E2E까지 테스트 방법.

### 내용

1. **단위 테스트**
   - reconciler를 순수 함수처럼 테스트
   - Context에 mock 클라이언트 주입

2. **Mock 테스트 (tower-test)**
   - `tower_test::mock::pair()` → ApiServerVerifier 패턴
   - 요청/응답 시나리오 설정
   - 한계: 복잡한 다중 호출 시나리오에서 설정이 장황

3. **통합 테스트 (k3d)**
   - k3d 클러스터 + CRD 등록 + 실제 reconcile
   - CI/CD에서 k3d 실행 (GitHub Actions 예시)
   - `await_condition()`으로 상태 수렴 대기

4. **E2E 테스트**
   - Docker 이미지 빌드 + 배포 + 검증
   - kubectl로 상태 확인

---

### optimization.md — 성능 최적화

**목적**: watcher, reflector, reconciler 각 단계에서의 최적화.

### 내용

1. **Watcher 최적화**
   - label/field selector로 감시 범위 축소
   - `metadata_watcher()`: 메타데이터만 watch → 메모리 절약
   - StreamingList: 초기 로드 시 메모리/API 호출 절약

2. **Reflector 최적화**
   - `.modify(|obj| { obj.managed_fields_mut().clear(); })` — 불필요한 필드 제거
   - 메모리 프로파일링 팁

3. **Reconciler 최적화**
   - 자기 자신의 변경으로 인한 재trigger 방지 (predicate_filter)
   - debounce 설정으로 burst 흡수
   - concurrency 조절: 기본 무제한 → 적절한 제한

4. **대규모 클러스터 고려사항**
   - pagination (기본 500개 페이지)
   - re-list 시 메모리 스파이크
   - 네임스페이스 단위 컨트롤러 분리

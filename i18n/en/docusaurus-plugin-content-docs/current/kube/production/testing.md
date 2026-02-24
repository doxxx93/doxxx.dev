---
sidebar_position: 2
title: "Testing"
description: "Unit testing, mock testing (tower-test), integration testing (k3d), E2E"
---

# Testing

Covers how to test controllers step by step, from unit tests to E2E tests using real clusters.

## Unit Tests

By keeping the reconciler close to a pure function, you can verify logic without making API calls. The key is separating state computation logic from API calls.

```rust
// Separate the logic only
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

Use unit tests to verify state determination logic (what ConfigMap to create), error classification logic (transient vs. permanent), and condition logic (whether reconciliation is needed).

## Mock Testing — tower-test

Use `tower_test::mock::pair()` to create a fake HTTP layer and inject it into the Client. This tests API call scenarios without a real Kubernetes cluster.

### ApiServerVerifier Pattern

```rust
use tower_test::mock;
use kube::Client;
use http::{Request, Response};
use hyper::Body;

#[tokio::test]
async fn test_reconcile_creates_configmap() {
    let (mock_service, handle) = mock::pair::<Request<Body>, Response<Body>>();
    let mock_client = Client::new(mock_service, "default");

    // Task acting as the API server
    let api_server = tokio::spawn(async move {
        // First request: GET ConfigMap (404 — does not exist, so it needs to be created)
        let (request, send_response) = handle.next_request().await.unwrap();
        assert!(request.uri().path().contains("/configmaps/test-config"));
        send_response.send_response(
            Response::builder()
                .status(404)
                .body(Body::from(serde_json::to_vec(
                    &not_found_status() // test helper — creates a 404 Status object
                ).unwrap()))
                .unwrap()
        );

        // Second request: PATCH ConfigMap (creation)
        let (request, send_response) = handle.next_request().await.unwrap();
        assert_eq!(request.method(), http::Method::PATCH);
        send_response.send_response(
            Response::new(Body::from(serde_json::to_vec(
                &configmap() // test helper — creates the expected ConfigMap object
            ).unwrap()))
        );
    });

    let ctx = Arc::new(Context { client: mock_client });
    let obj = Arc::new(test_resource()); // test helper — creates a MyResource test object
    let result = reconcile(obj, ctx).await;
    assert!(result.is_ok());

    api_server.await.unwrap();
}
```

### Limitations

| Limitation | Description |
|-----------|-------------|
| Order-dependent | Request order must match exactly. Tests fail if the order changes |
| Verbose setup | Mock setup code becomes lengthy for multi-request scenarios |
| Watcher mock | Additional setup is required to mock watcher streams |

Mock tests are useful for verifying that the reconciler makes the correct API calls. However, for complex scenarios, integration tests are more suitable.

## Integration Testing — k3d

Run the controller against a real Kubernetes cluster and verify the results. [k3d](https://k3d.io) runs lightweight Kubernetes clusters locally.

### Cluster Setup

```bash
# Create a k3d cluster (no load balancer needed)
k3d cluster create test --no-lb

# Register the CRD
kubectl apply -f manifests/crd.yaml
```

### Test Code

```rust
use kube::runtime::wait::await_condition;

#[tokio::test]
#[ignore] // Run only in CI
async fn test_reconcile_creates_resources() {
    let client = Client::try_default().await.unwrap();
    let api = Api::<MyResource>::namespaced(client.clone(), "default");

    // Create the resource
    api.create(&PostParams::default(), &test_resource()).await.unwrap();

    // Wait for state convergence
    let cond = await_condition(api.clone(), "test", |obj: Option<&MyResource>| {
        obj.and_then(|o| o.status.as_ref())
           .map(|s| s.phase == "Ready")
           .unwrap_or(false)
    });
    tokio::time::timeout(Duration::from_secs(30), cond)
        .await
        .expect("timeout waiting for Ready")
        .expect("watch error");

    // Verify child resources
    let cm_api = Api::<ConfigMap>::namespaced(client, "default");
    let cm = cm_api.get("test-config").await.expect("ConfigMap not found");
    assert_eq!(cm.data.unwrap()["key"], "expected-value");

    // Cleanup
    api.delete("test", &DeleteParams::default()).await.unwrap();
}
```

`await_condition()` opens a watch stream and waits until the condition is satisfied. Wrap it with `tokio::time::timeout()` to prevent waiting indefinitely.

### CI Setup (GitHub Actions)

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

## E2E Testing

Build the controller as a Docker image, deploy it, and then verify its behavior. Unlike integration tests, the controller runs as a Pod rather than an in-process instance.

```bash
# 1. Build the image
docker build -t my-controller:test .

# 2. Import the image into the k3d cluster
k3d image import my-controller:test -c test

# 3. Deploy the controller
kubectl apply -f manifests/deployment.yaml

# 4. Wait for the controller to be ready
kubectl wait --for=condition=available deployment/my-controller --timeout=60s

# 5. Apply test resources
kubectl apply -f test-fixtures/

# 6. Verify state convergence
kubectl wait --for=jsonpath='.status.phase'=Ready myresource/test --timeout=60s
```

E2E tests verify items that can only be validated in a deployment environment, such as RBAC, resource limits, health probes, and graceful shutdown.

## Comparison Summary

| Stage | Speed | Required Environment | Verification Scope |
|-------|-------|---------------------|-------------------|
| Unit | Milliseconds | None | State computation logic |
| Mock | Seconds | None | API call scenarios |
| Integration | Minutes | k3d | Reconcile flow, CRD registration |
| E2E | Minutes | k3d + Docker | RBAC, deployment, full system |

The typical approach follows a pyramid structure: write the most unit tests, verify key scenarios with mock and integration tests, and run E2E tests only in the deployment pipeline.

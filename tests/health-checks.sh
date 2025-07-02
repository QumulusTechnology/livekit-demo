#!/bin/bash

# Health Check Tests for LiveKit Demo Platform
# Tests basic availability and health of all services

set -e

KUBECONFIG=${KUBECONFIG:-~/livekit-demo-k8s.config}
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
RESULTS_DIR="./results"
RESULTS_FILE="$RESULTS_DIR/health-check-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Starting Health Check Tests - $TIMESTAMP"
echo "Results will be saved to: $RESULTS_FILE"

# Initialize results JSON
cat > "$RESULTS_FILE" << 'EOF'
{
  "timestamp": "",
  "test_type": "health_checks",
  "tests": [],
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "success_rate": "0%"
  }
}
EOF

# Update timestamp
jq --arg ts "$TIMESTAMP" '.timestamp = $ts' "$RESULTS_FILE" > tmp.$$ && mv tmp.$$ "$RESULTS_FILE"

TOTAL_TESTS=0
PASSED_TESTS=0

# Function to add test result
add_test_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local duration="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
    
    jq --arg name "$test_name" --arg status "$status" --arg details "$details" --arg duration "$duration" \
       '.tests += [{"name": $name, "status": $status, "details": $details, "duration": $duration}]' \
       "$RESULTS_FILE" > tmp.$$ && mv tmp.$$ "$RESULTS_FILE"
}

# Test 1: ArgoCD Health
echo "🧪 Testing ArgoCD Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://argocd.livekit-demo.cloudportal.app/api/version | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ ArgoCD is healthy"
    add_test_result "ArgoCD Health" "PASS" "API endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ ArgoCD health check failed"
    add_test_result "ArgoCD Health" "FAIL" "API endpoint not responding or returning error" "${duration}s"
fi

# Test 2: LiveKit Server Health
echo "🧪 Testing LiveKit Server Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://livekit.livekit-demo.cloudportal.app | grep -q "404\|400\|200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ LiveKit Server is reachable"
    add_test_result "LiveKit Server Health" "PASS" "Server endpoint is accessible" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ LiveKit Server health check failed"
    add_test_result "LiveKit Server Health" "FAIL" "Server endpoint not reachable" "${duration}s"
fi

# Test 3: LiveKit Frontend Health
echo "🧪 Testing LiveKit Frontend Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://meet.livekit-demo.cloudportal.app | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ LiveKit Frontend is healthy"
    add_test_result "LiveKit Frontend Health" "PASS" "Frontend loading successfully" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ LiveKit Frontend health check failed"
    add_test_result "LiveKit Frontend Health" "FAIL" "Frontend not accessible or returning error" "${duration}s"
fi

# Test 4: Grafana Health
echo "🧪 Testing Grafana Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://grafana.livekit-demo.cloudportal.app/api/health | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Grafana is healthy"
    add_test_result "Grafana Health" "PASS" "Health endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Grafana health check failed"
    add_test_result "Grafana Health" "FAIL" "Health endpoint not responding" "${duration}s"
fi

# Test 5: Harbor Container Registry Health
echo "🧪 Testing Harbor Container Registry Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://repo.livekit-demo.cloudportal.app/api/v2.0/health | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Harbor is healthy"
    add_test_result "Harbor Health" "PASS" "API health endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Harbor health check failed"
    add_test_result "Harbor Health" "FAIL" "API health endpoint not responding" "${duration}s"
fi

# Test 6: MinIO Console Health
echo "🧪 Testing MinIO Console Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://s3.livekit-demo.cloudportal.app | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ MinIO Console is healthy"
    add_test_result "MinIO Console Health" "PASS" "Console endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ MinIO Console health check failed"
    add_test_result "MinIO Console Health" "FAIL" "Console endpoint not responding" "${duration}s"
fi

# Test 7: MinIO API Health
echo "🧪 Testing MinIO API Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://s3api.livekit-demo.cloudportal.app/minio/health/live | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ MinIO API is healthy"
    add_test_result "MinIO API Health" "PASS" "S3 API health endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ MinIO API health check failed"
    add_test_result "MinIO API Health" "FAIL" "S3 API health endpoint not responding" "${duration}s"
fi

# Test 8: MinIO Operator Health
echo "🧪 Testing MinIO Operator Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://minio-operator.livekit-demo.cloudportal.app | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ MinIO Operator is healthy"
    add_test_result "MinIO Operator Health" "PASS" "Operator interface responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ MinIO Operator health check failed"
    add_test_result "MinIO Operator Health" "FAIL" "Operator interface not responding" "${duration}s"
fi

# Test 9: Meet Client Frontend Health
echo "🧪 Testing Meet Client Frontend Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://meet.livekit-demo.cloudportal.app | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Meet Client Frontend is healthy"
    add_test_result "Meet Client Health" "PASS" "Frontend responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Meet Client Frontend health check failed"
    add_test_result "Meet Client Health" "FAIL" "Frontend not responding" "${duration}s"
fi

# Test 10: Trivoh Frontend Health
echo "🧪 Testing Trivoh Frontend Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://trivoh.livekit-demo.cloudportal.app | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Trivoh Frontend is healthy"
    add_test_result "Trivoh Frontend Health" "PASS" "Frontend responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Trivoh Frontend health check failed"
    add_test_result "Trivoh Frontend Health" "FAIL" "Frontend not responding" "${duration}s"
fi

# Test 11: Trivoh API Health
echo "🧪 Testing Trivoh API Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://api.livekit-demo.cloudportal.app/health | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Trivoh API is healthy"
    add_test_result "Trivoh API Health" "PASS" "API health endpoint responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Trivoh API health check failed"
    add_test_result "Trivoh API Health" "FAIL" "API health endpoint not responding" "${duration}s"
fi

# Test 12: Loki API Health
echo "🧪 Testing Loki API Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://gateway-loki.livekit-demo.cloudportal.app/ready | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Loki API is healthy"
    add_test_result "Loki API Health" "PASS" "Log aggregation API responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Loki API health check failed"
    add_test_result "Loki API Health" "FAIL" "Log aggregation API not responding" "${duration}s"
fi

# Test 13: Mimir API Health
echo "🧪 Testing Mimir API Health..."
start_time=$(date +%s)
if curl -s -k -o /dev/null -w "%{http_code}" https://mimir.livekit-demo.cloudportal.app/ready | grep -q "200"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Mimir API is healthy"
    add_test_result "Mimir API Health" "PASS" "Metrics storage API responding with 200" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Mimir API health check failed"
    add_test_result "Mimir API Health" "FAIL" "Metrics storage API not responding" "${duration}s"
fi

# Test 14: Kubernetes Pod Health
echo "🧪 Testing Kubernetes Pod Health..."
start_time=$(date +%s)
failed_pods=$(KUBECONFIG="$KUBECONFIG" kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)
if [ "$failed_pods" -eq 0 ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ All pods are healthy"
    add_test_result "Kubernetes Pod Health" "PASS" "All pods running or succeeded" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ $failed_pods pods are not healthy"
    add_test_result "Kubernetes Pod Health" "FAIL" "$failed_pods pods in failed state" "${duration}s"
fi

# Test 15: LiveKit Pods Specifically
echo "🧪 Testing LiveKit Pods Specifically..."
start_time=$(date +%s)
livekit_pods=$(KUBECONFIG="$KUBECONFIG" kubectl get pods -n livekit --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$livekit_pods" -gt 0 ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ $livekit_pods LiveKit pods are running"
    add_test_result "LiveKit Pods Health" "PASS" "$livekit_pods pods running in livekit namespace" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ No LiveKit pods are running"
    add_test_result "LiveKit Pods Health" "FAIL" "No running pods found in livekit namespace" "${duration}s"
fi

# Test 16: Redis Cluster Health
echo "🧪 Testing Redis Cluster Health..."
start_time=$(date +%s)
redis_pods=$(KUBECONFIG="$KUBECONFIG" kubectl get pods -n redis --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$redis_pods" -ge 6 ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Redis cluster is healthy ($redis_pods pods running)"
    add_test_result "Redis Cluster Health" "PASS" "$redis_pods Redis pods running" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Redis cluster unhealthy ($redis_pods pods running, expected 6+)"
    add_test_result "Redis Cluster Health" "FAIL" "Only $redis_pods Redis pods running, expected 6+" "${duration}s"
fi

# Test 17: Ingress Controller Health
echo "🧪 Testing Ingress Controller Health..."
start_time=$(date +%s)
ingress_pods=$(KUBECONFIG="$KUBECONFIG" kubectl get pods -n ingress-nginx --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$ingress_pods" -gt 0 ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "✅ Ingress controller is healthy"
    add_test_result "Ingress Controller Health" "PASS" "$ingress_pods ingress pods running" "${duration}s"
else
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "❌ Ingress controller unhealthy"
    add_test_result "Ingress Controller Health" "FAIL" "No ingress controller pods running" "${duration}s"
fi

# Calculate summary
success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)

# Update summary
jq --arg total "$TOTAL_TESTS" --arg passed "$PASSED_TESTS" --arg failed "$((TOTAL_TESTS - PASSED_TESTS))" --arg rate "${success_rate}%" \
   '.summary.total = ($total | tonumber) | .summary.passed = ($passed | tonumber) | .summary.failed = ($failed | tonumber) | .summary.success_rate = $rate' \
   "$RESULTS_FILE" > tmp.$$ && mv tmp.$$ "$RESULTS_FILE"

echo ""
echo "📊 Health Check Summary:"
echo "   Total Tests: $TOTAL_TESTS"
echo "   Passed: $PASSED_TESTS"
echo "   Failed: $((TOTAL_TESTS - PASSED_TESTS))"
echo "   Success Rate: ${success_rate}%"
echo ""
echo "📁 Detailed results saved to: $RESULTS_FILE"

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
    echo "🎉 All health checks passed!"
    exit 0
else
    echo "⚠️  Some health checks failed. Check the detailed results."
    exit 1
fi
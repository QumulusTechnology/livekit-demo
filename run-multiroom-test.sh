#!/bin/bash
# Multi-room load test to simulate distributed load

set -e

# Test configuration
API_KEY="LKAPIpaG14RWGIP9P7ka6"
API_SECRET="9keB8rUAFWCH4b1Ob9Q79etDfPSMCTRkFs89tRg5"
URL="wss://ws.livekit-demo.cloudportal.app"
ROOMS=10
PARTICIPANTS_PER_ROOM=100
PUBLISHERS_PER_ROOM=10
SUBSCRIBERS_PER_ROOM=90
DURATION="30s"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "=== LiveKit Multi-Room Load Test ==="
echo "Configuration:"
echo "- Rooms: $ROOMS"
echo "- Participants per room: $PARTICIPANTS_PER_ROOM"
echo "- Total participants: $((ROOMS * PARTICIPANTS_PER_ROOM))"
echo "- Duration: $DURATION"
echo ""

# Start monitoring in background
echo "Starting Kubernetes monitoring..."
(
    while true; do
        echo "=== Monitoring at $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> multiroom-test-$TIMESTAMP-monitoring.log
        KUBECONFIG=~/livekit-demo-k8s.config kubectl get hpa -n livekit >> multiroom-test-$TIMESTAMP-monitoring.log 2>&1
        echo "" >> multiroom-test-$TIMESTAMP-monitoring.log
        KUBECONFIG=~/livekit-demo-k8s.config kubectl top pods -n livekit | grep livekit-server >> multiroom-test-$TIMESTAMP-monitoring.log 2>&1 || true
        echo "" >> multiroom-test-$TIMESTAMP-monitoring.log
        sleep 10
    done
) &
MONITOR_PID=$!

# Function to clean up
cleanup() {
    echo "Cleaning up..."
    kill $MONITOR_PID 2>/dev/null || true
    wait
}
trap cleanup EXIT

# Launch load tests for each room
echo "Launching load tests..."
PIDS=()

for i in $(seq 0 $((ROOMS - 1))); do
    echo "Starting room $i..."
    lk load-test \
        --url "$URL" \
        --api-key "$API_KEY" \
        --api-secret "$API_SECRET" \
        --room "multiroom-test-$i" \
        --publishers "$PUBLISHERS_PER_ROOM" \
        --subscribers "$SUBSCRIBERS_PER_ROOM" \
        --duration "$DURATION" \
        > "multiroom-test-$TIMESTAMP-room-$i.log" 2>&1 &
    
    PIDS+=($!)
    sleep 2  # Stagger room creation
done

echo "All rooms launched. Waiting for completion..."

# Wait for all tests to complete
SUCCESS_COUNT=0
FAIL_COUNT=0

for i in "${!PIDS[@]}"; do
    if wait ${PIDS[$i]}; then
        echo "Room $i: SUCCESS"
        ((SUCCESS_COUNT++))
    else
        echo "Room $i: FAILED"
        ((FAIL_COUNT++))
    fi
done

# Stop monitoring
kill $MONITOR_PID 2>/dev/null || true

# Collect final metrics
echo ""
echo "=== Final Metrics ==="
KUBECONFIG=~/livekit-demo-k8s.config kubectl get hpa -n livekit
echo ""
KUBECONFIG=~/livekit-demo-k8s.config kubectl top pods -n livekit | head -20

# Summary
echo ""
echo "=== Test Summary ==="
echo "Total rooms: $ROOMS"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "Total participants attempted: $((ROOMS * PARTICIPANTS_PER_ROOM))"
echo "Logs saved to: multiroom-test-$TIMESTAMP-*.log"
echo "Monitoring log: multiroom-test-$TIMESTAMP-monitoring.log"

# Extract packet loss from logs
echo ""
echo "=== Packet Loss Summary ==="
for i in $(seq 0 $((ROOMS - 1))); do
    if [ -f "multiroom-test-$TIMESTAMP-room-$i.log" ]; then
        LOSS=$(grep -E "Packet Loss.*%" "multiroom-test-$TIMESTAMP-room-$i.log" | tail -1 || echo "No data")
        echo "Room $i: $LOSS"
    fi
done
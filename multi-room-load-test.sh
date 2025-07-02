#!/bin/bash

# Multi-room load test for LiveKit with performance monitoring
# Distributes 1000 participants across 10 rooms (100 per room)
# Video resolution set to "low" to reduce bandwidth by ~50%

# Load credentials from Kubernetes secret
KUBECONFIG="${KUBECONFIG:-~/livekit-demo-k8s.config}"
echo "Loading LiveKit credentials from Kubernetes secret..."

# Get the keys.yaml content from the secret
KEYS_YAML=$(kubectl --kubeconfig="$KUBECONFIG" get secret livekit-keys-file -n livekit -o jsonpath='{.data.keys\.yaml}' | base64 -d)

if [ -z "$KEYS_YAML" ]; then
  echo "Error: Failed to load credentials from Kubernetes secret"
  exit 1
fi

# Extract API key and secret from format "API_KEY: API_SECRET"
API_KEY=$(echo "$KEYS_YAML" | cut -d':' -f1 | tr -d ' ')
API_SECRET=$(echo "$KEYS_YAML" | cut -d':' -f2 | tr -d ' ')

if [ -z "$API_KEY" ] || [ -z "$API_SECRET" ]; then
  echo "Error: Failed to parse API credentials from secret"
  exit 1
fi

echo "Successfully loaded credentials from Kubernetes"
echo "API Key: ${API_KEY:0:10}..." # Show only first 10 chars for security

URL="wss://ws.livekit-demo.cloudportal.app"
DURATION="300s"
TIMESTAMP=$(date +%s)
RESULTS_DIR="load-test-results-${TIMESTAMP}"
mkdir -p "$RESULTS_DIR"

echo "Starting multi-room load test with 1000 total participants across 10 rooms..."
echo "Each room will have: 10 video publishers, 20 audio publishers, 70 subscribers"
echo "Video resolution: LOW (50% bandwidth reduction)"
echo "Test duration: $DURATION"
echo "Results will be saved to: $RESULTS_DIR"
echo ""

# Function to monitor network traffic
monitor_network() {
  local pod=$1
  local output_file=$2
  local duration=$3
  
  echo "Monitoring network traffic for pod $pod..."
  
  # Start monitoring in background
  kubectl --kubeconfig="$KUBECONFIG" exec -n livekit "$pod" -- sh -c "
    # Get initial packet counts
    initial_rx=\$(cat /sys/class/net/eth0/statistics/rx_packets 2>/dev/null || echo 0)
    initial_tx=\$(cat /sys/class/net/eth0/statistics/tx_packets 2>/dev/null || echo 0)
    initial_rx_dropped=\$(cat /sys/class/net/eth0/statistics/rx_dropped 2>/dev/null || echo 0)
    initial_tx_dropped=\$(cat /sys/class/net/eth0/statistics/tx_dropped 2>/dev/null || echo 0)
    initial_rx_bytes=\$(cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null || echo 0)
    initial_tx_bytes=\$(cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null || echo 0)
    
    sleep $duration
    
    # Get final packet counts
    final_rx=\$(cat /sys/class/net/eth0/statistics/rx_packets 2>/dev/null || echo 0)
    final_tx=\$(cat /sys/class/net/eth0/statistics/tx_packets 2>/dev/null || echo 0)
    final_rx_dropped=\$(cat /sys/class/net/eth0/statistics/rx_dropped 2>/dev/null || echo 0)
    final_tx_dropped=\$(cat /sys/class/net/eth0/statistics/tx_dropped 2>/dev/null || echo 0)
    final_rx_bytes=\$(cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null || echo 0)
    final_tx_bytes=\$(cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null || echo 0)
    
    # Calculate differences
    rx_packets=\$((final_rx - initial_rx))
    tx_packets=\$((final_tx - initial_tx))
    rx_dropped=\$((final_rx_dropped - initial_rx_dropped))
    tx_dropped=\$((final_tx_dropped - initial_tx_dropped))
    rx_bytes=\$((final_rx_bytes - initial_rx_bytes))
    tx_bytes=\$((final_tx_bytes - initial_tx_bytes))
    
    total_packets=\$((rx_packets + tx_packets))
    total_dropped=\$((rx_dropped + tx_dropped))
    
    if [ \$total_packets -gt 0 ]; then
      packet_loss=\$(echo \"scale=4; \$total_dropped * 100 / \$total_packets\" | bc)
    else
      packet_loss=0
    fi
    
    rx_mbps=\$(echo \"scale=2; \$rx_bytes * 8 / 1000000 / $duration\" | bc)
    tx_mbps=\$(echo \"scale=2; \$tx_bytes * 8 / 1000000 / $duration\" | bc)
    
    echo \"Pod: $pod\"
    echo \"RX Packets: \$rx_packets, TX Packets: \$tx_packets\"
    echo \"RX Dropped: \$rx_dropped, TX Dropped: \$tx_dropped\"
    echo \"Packet Loss: \${packet_loss}%\"
    echo \"RX: \${rx_mbps} Mbps, TX: \${tx_mbps} Mbps\"
    echo \"Total RX: \$((rx_bytes / 1024 / 1024)) MB, Total TX: \$((tx_bytes / 1024 / 1024)) MB\"
  " > "$output_file" 2>&1 &
}

# Start monitoring network on a few representative pods
echo "Starting network monitoring..."
MONITOR_PODS=$(kubectl --kubeconfig="$KUBECONFIG" get pods -n livekit -o name | grep livekit-server | head -3 | cut -d/ -f2)
for pod in $MONITOR_PODS; do
  monitor_network "$pod" "$RESULTS_DIR/network-$pod.txt" 300 &
done

# Record initial system state
echo "Recording initial system state..."
kubectl --kubeconfig="$KUBECONFIG" top nodes > "$RESULTS_DIR/nodes-initial.txt"
kubectl --kubeconfig="$KUBECONFIG" top pods -n livekit > "$RESULTS_DIR/pods-initial.txt"

# Start load tests in parallel for 10 rooms with reduced bandwidth
for i in {1..10}; do
  ROOM="loadtest-room${i}-${TIMESTAMP}"
  echo "Starting load test for $ROOM (low resolution video)..."
  
  lk load-test \
    --url "$URL" \
    --api-key "$API_KEY" \
    --api-secret "$API_SECRET" \
    --room "$ROOM" \
    --video-publishers 10 \
    --audio-publishers 20 \
    --subscribers 70 \
    --video-resolution low \
    --duration "$DURATION" > "$RESULTS_DIR/room-${i}.log" 2>&1 &
  
  # Small delay between room starts to avoid thundering herd
  sleep 2
done

echo ""
echo "All 10 room load tests started. Monitoring performance..."
echo "Total participants: 1000 (100 per room)"
echo ""

# Monitor system during test
sleep 30  # Let the test stabilize
echo "Recording mid-test system state..."
kubectl --kubeconfig="$KUBECONFIG" top nodes > "$RESULTS_DIR/nodes-midtest.txt"
kubectl --kubeconfig="$KUBECONFIG" top pods -n livekit > "$RESULTS_DIR/pods-midtest.txt"

# Wait for all background jobs to complete
wait

# Record final system state
echo "Recording final system state..."
kubectl --kubeconfig="$KUBECONFIG" top nodes > "$RESULTS_DIR/nodes-final.txt"
kubectl --kubeconfig="$KUBECONFIG" top pods -n livekit > "$RESULTS_DIR/pods-final.txt"

# Generate summary report
echo ""
echo "Generating test summary..."
cat > "$RESULTS_DIR/summary.txt" << EOF
Load Test Summary
================
Timestamp: $(date)
Duration: $DURATION
Total Participants: 1000 (100 per room x 10 rooms)
Video Resolution: Low (50% bandwidth reduction)
Configuration per room:
- Video Publishers: 10
- Audio Publishers: 20
- Subscribers: 70

Network Traffic Results:
=======================
EOF

# Aggregate network results
for file in "$RESULTS_DIR"/network-*.txt; do
  if [ -f "$file" ]; then
    echo "" >> "$RESULTS_DIR/summary.txt"
    cat "$file" >> "$RESULTS_DIR/summary.txt"
    echo "---" >> "$RESULTS_DIR/summary.txt"
  fi
done

echo "" >> "$RESULTS_DIR/summary.txt"
echo "Test logs saved in: $RESULTS_DIR" >> "$RESULTS_DIR/summary.txt"

# Display summary
cat "$RESULTS_DIR/summary.txt"

echo ""
echo "Multi-room load test completed!"
echo "Full results saved in: $RESULTS_DIR"
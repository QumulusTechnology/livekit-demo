# Distributed Load Test - Expected Results

## Test Configuration
- **VMs**: 10 Ubuntu Noble instances (c1.large: 4 vCPUs, 8GB RAM)
- **Participants per VM**: 100 (10 video publishers, 20 audio publishers, 70 subscribers)
- **Total Participants**: 1000
- **Video Resolution**: Medium
- **Test Duration**: 5 minutes
- **Rooms**: 10 (1 per VM)

## Expected Performance Metrics

### Per VM Metrics
- **Bandwidth**: 50-70 Mbps (medium resolution)
- **CPU Usage**: 40-60%
- **Memory Usage**: 2-3 GB
- **Packet Loss**: < 2%
- **Network**: ~500-700 kbps per participant

### Aggregate Metrics
- **Total Bandwidth**: 500-700 Mbps
- **Total Connections**: 1000
- **Success Rate**: > 95%

### LiveKit Server Scaling
- **Initial Pods**: 10-12
- **Peak Pods**: 15-20 (with HPA)
- **CPU per Pod**: 1000-3000m
- **Memory per Pod**: 500-2000 Mi

## Network Distribution
Each VM creates its own room, ensuring:
- Even load distribution across LiveKit pods
- No single point of bottleneck
- Realistic multi-room scenario
- True distributed testing from different network locations
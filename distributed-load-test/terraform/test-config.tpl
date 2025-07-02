---
# LiveKit Load Test Configuration
livekit_url: "${livekit_url}"
test_duration: "${test_duration}"
participants_per_vm: ${participants_per_vm}
video_resolution: "${video_resolution}"
total_vms: ${total_vms}
total_participants: ${total_participants}

# Room distribution
rooms_per_vm: 1  # Each VM handles one room
publishers_per_room: ${ floor(participants_per_vm * 0.1) }  # 10% publishers
video_publishers_per_room: ${ floor(participants_per_vm * 0.05) }  # 5% video publishers
subscribers_per_room: ${ participants_per_vm - floor(participants_per_vm * 0.1) }  # 90% subscribers

# Performance monitoring
monitor_interval: 10  # seconds
collect_metrics: true
generate_report: true
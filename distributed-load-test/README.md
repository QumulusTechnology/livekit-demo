# Distributed Load Testing for LiveKit

This directory contains a complete solution for running distributed load tests against LiveKit infrastructure using Terraform and Ansible.

## Overview

The solution automatically:
1. Provisions 10 Ubuntu Noble VMs on OpenStack using Terraform
2. Configures VMs with performance optimizations for load testing
3. Installs LiveKit CLI and monitoring tools
4. Runs synchronized load tests across all VMs
5. Collects results and generates a comprehensive report

## Architecture

```
┌─────────────────────┐
│   Control Node      │
│  (Your machine)     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │  Terraform  │ Creates 10 VMs
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │   Ansible   │ Configures & orchestrates
    └──────┬──────┘
           │
┌──────────┴──────────────────────────┐
│         Load Test VMs (10x)         │
│  ┌─────┐ ┌─────┐ ... ┌─────┐      │
│  │ VM1 │ │ VM2 │     │VM10 │      │
│  └─────┘ └─────┘     └─────┘      │
│   100     100         100          │
│  users   users       users         │
└─────────────────────────────────────┘
           │
           ▼
    LiveKit Cluster
```

## Prerequisites

1. OpenStack credentials configured (`~/livekit-demo-rc.sh`)
2. Kubernetes config for LiveKit cluster (`~/livekit-demo-k8s.config`)
3. SSH key pair named `livekit-demo` in OpenStack
4. Tools installed:
   - Terraform >= 1.0
   - Ansible >= 2.9
   - kubectl
   - jq

## Quick Start

```bash
# Run the complete test
./run-distributed-test.sh
```

This will:
- Create 10 VMs (c1.large: 4 vCPUs, 8GB RAM each)
- Configure them for optimal load testing
- Run a 5-minute load test with 100 participants per VM (1000 total)
- Generate a comprehensive HTML report

## Manual Steps

### 1. Create Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 2. Configure VMs

```bash
cd ../ansible
ansible-playbook playbooks/01-configure-vms.yml -i inventory.ini
```

### 3. Prepare Test

```bash
ansible-playbook playbooks/02-prepare-test.yml -i inventory.ini
```

### 4. Run Load Test

```bash
ansible-playbook playbooks/03-run-load-test.yml -i inventory.ini
```

### 5. Collect Results

```bash
ansible-playbook playbooks/04-collect-results.yml -i inventory.ini
```

## Configuration

Edit `terraform/variables.tf` to customize:
- `instance_count`: Number of VMs (default: 10)
- `instance_flavor`: VM size (default: c1.large)
- `participants_per_vm`: Load per VM (default: 100)
- `video_resolution`: Video quality (default: low)
- `test_duration`: Test length (default: 5m)

## VM Optimizations

Each VM is automatically configured with:
- Network buffer tuning (128MB buffers)
- BBR congestion control
- Increased file descriptor limits (1M)
- Connection tracking for 500K+ connections
- Performance monitoring tools

## Monitoring

During the test, each VM collects:
- System metrics (CPU, memory, network)
- Network statistics and packet loss
- LiveKit CLI output and metrics
- Connection success rates

## Results

After the test completes, you'll find:
- `results/final-report.html`: Comprehensive HTML report
- `results/summary-stats.json`: Summary statistics
- `results/vm-*-results.tar.gz`: Raw data from each VM

## Performance Expectations

With 10 VMs running 100 participants each:
- Total participants: 1000
- Total bandwidth: ~300-500 Mbps (with low resolution video)
- Expected packet loss: < 3%
- VM resource usage: 40-60% CPU, 2-3GB RAM

## Troubleshooting

### VMs not accessible
```bash
# Check VM status
cd terraform
terraform show

# Verify security groups
openstack security group rule list load-test-sg
```

### Ansible connection issues
```bash
# Test connectivity
ansible all -i inventory.ini -m ping

# Check SSH key
ssh -i ~/.ssh/id_ed25519 ubuntu@<vm-ip>
```

### Load test failures
- Check LiveKit credentials are properly loaded
- Verify LiveKit URL is accessible from VMs
- Review logs in `results/vm-*/logs/`

## Cleanup

```bash
# Destroy all VMs
cd terraform
terraform destroy
```

## Advanced Usage

### Custom Test Scenarios

Edit `ansible/test-config.yml` after running Terraform:
```yaml
participants_per_vm: 200  # Increase load
video_resolution: "high"  # Higher quality
test_duration: "10m"     # Longer test
```

### Running Specific Playbooks

```bash
# Just run the test again (VMs already exist)
ansible-playbook playbooks/03-run-load-test.yml -i inventory.ini

# Collect results only
ansible-playbook playbooks/04-collect-results.yml -i inventory.ini
```

### Parallel Execution

The load test uses Ansible's `free` strategy to allow VMs to proceed independently, ensuring true distributed testing.

## Cost Estimation

- VM cost: ~$0.10/hour per c1.large instance
- Test duration: ~30 minutes total (including setup)
- Total cost per test: ~$0.50 for 10 VMs

Remember to destroy VMs after testing to avoid ongoing charges!
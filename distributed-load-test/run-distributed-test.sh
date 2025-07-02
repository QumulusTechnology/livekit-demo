#!/bin/bash
# Main orchestration script for distributed load testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Setup logging
LOG_FILE="distributed-test-$(date +%Y%m%d-%H%M%S).log"
echo "Logging to: $LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Function to log colored output
log_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}" | tee -a "$LOG_FILE"
}

log_color "$GREEN" "=== LiveKit Distributed Load Test ==="
log "This script will:"
log "1. Create 10 VMs using Terraform"
log "2. Configure VMs for load testing"
log "3. Run distributed load test"
log "4. Collect and analyze results"
log ""

# Check prerequisites
log_color "$YELLOW" "Checking prerequisites..."

# Source OpenStack credentials
if [ -f ~/livekit-demo-rc.sh ]; then
    source ~/livekit-demo-rc.sh
    log "✓ OpenStack credentials loaded"
else
    log_color "$RED" "Error: ~/livekit-demo-rc.sh not found"
    exit 1
fi

# Check SSH agent
if [ -z "$SSH_AUTH_SOCK" ]; then
    log_color "$RED" "Error: SSH agent not running"
    exit 1
fi

log "✓ SSH agent detected"
SSH_KEYS=$(ssh-add -l | wc -l)
log "  Found $SSH_KEYS keys loaded in ssh-agent"

# Check kubectl config
if [ -f ~/livekit-demo-k8s.config ]; then
    export KUBECONFIG=~/livekit-demo-k8s.config
    log "✓ Kubernetes config found"
else
    log_color "$RED" "Error: ~/livekit-demo-k8s.config not found"
    exit 1
fi

# Check required tools
for tool in terraform ansible-playbook jq; do
    if ! command -v $tool &> /dev/null; then
        log_color "$RED" "Error: $tool is not installed"
        exit 1
    fi
done
log "✓ Required tools installed"

# Step 1: Terraform - Create VMs
log ""
log_color "$YELLOW" "Step 1: Creating VMs with Terraform..."
cd terraform

log "Running terraform init..."
terraform init >> "../$LOG_FILE" 2>&1

log "Running terraform plan..."
terraform plan -out=tfplan >> "../$LOG_FILE" 2>&1

log "Applying terraform configuration (auto-approved)..."
terraform apply -auto-approve tfplan | tee -a "../$LOG_FILE"

# Get the number of VMs created
VM_COUNT=$(terraform output -json load_test_vms | jq 'length')
log_color "$GREEN" "✓ Created $VM_COUNT VMs"

# Step 2: Wait for VMs to be ready
log ""
log_color "$YELLOW" "Step 2: Waiting for VMs to be ready..."
cd ../ansible

# Wait for VMs to become reachable with retries
MAX_RETRIES=15
RETRY_DELAY=1
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    log "Testing VM connectivity (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."

    # Run ansible ping and capture the result
    PING_OUTPUT=$(ansible all -i inventory.ini -m ping --one-line 2>&1 | tee -a "$LOG_FILE")

    # Check the actual results
    REACHABLE=$(echo "$PING_OUTPUT" | grep -c "SUCCESS" || true)
    TOTAL=$(ansible all -i inventory.ini --list-hosts 2>/dev/null | grep -c "^    " || true)

    if [ $REACHABLE -eq $TOTAL ] && [ $TOTAL -gt 0 ]; then
        log_color "$GREEN" "✓ All VMs are reachable ($REACHABLE/$TOTAL)"
        break
    else
        log "Currently $REACHABLE out of $TOTAL VMs are reachable"

        if [ $REACHABLE -gt 0 ]; then
            log_color "$YELLOW" "Warning: Some VMs are not reachable yet"
        fi

        if [ $RETRY_COUNT -eq $((MAX_RETRIES - 1)) ]; then
            if [ $REACHABLE -eq 0 ]; then
                log_color "$RED" "Error: No VMs are reachable after $MAX_RETRIES attempts"
                log "Please check:"
                log "  1. SSH key is loaded in ssh-agent (ssh-add -l)"
                log "  2. Security group allows SSH access"
                log "  3. VMs are fully booted"
                exit 1
            else
                log_color "$YELLOW" "Warning: Only $REACHABLE out of $TOTAL VMs are reachable"
                log "Proceeding with available VMs..."
                break
            fi
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "Waiting $RETRY_DELAY seconds before retry..."
        sleep $RETRY_DELAY
    fi
done

# Step 3: Configure VMs
log ""
log_color "$YELLOW" "Step 3: Configuring VMs..."
ansible-playbook playbooks/01-configure-vms.yml -i inventory.ini >> "$LOG_FILE" 2>&1
log "✓ VMs configured"

# Step 4: Prepare test environment
log ""
log_color "$YELLOW" "Step 4: Preparing test environment..."
ansible-playbook playbooks/02-prepare-test.yml -i inventory.ini >> "$LOG_FILE" 2>&1
log "✓ Test environment prepared"

# Step 5: Run load test
log ""
log_color "$YELLOW" "Step 5: Running distributed load test..."
log "Starting load test with:"
log "- VMs: $VM_COUNT"
log "- Participants per VM: 100"
log "- Total participants: $((VM_COUNT * 100))"
log "- Duration: 5 minutes"
log ""

ansible-playbook playbooks/03-run-load-test.yml -i inventory.ini | tee -a "$LOG_FILE"

# Step 6: Collect results
log ""
log_color "$YELLOW" "Step 6: Collecting results..."
ansible-playbook playbooks/04-collect-results.yml -i inventory.ini >> "$LOG_FILE" 2>&1

# Display results location
log ""
log_color "$GREEN" "=== Load Test Complete ==="
log "Results available at:"
log "- Summary: results/summary-stats.json"
log "- Full report: results/final-report.html"
log "- LiveKit metrics: results/livekit-metrics/"
log "- Test log: $LOG_FILE"
log ""

# Automatic cleanup
log_color "$YELLOW" "Cleaning up test VMs..."
cd ../terraform
terraform destroy -auto-approve >> "../$LOG_FILE" 2>&1
if [ $? -eq 0 ]; then
    log_color "$GREEN" "✓ Test VMs destroyed successfully"
else
    log_color "$RED" "Warning: Failed to destroy some VMs. Please check manually."
fi

log_color "$GREEN" "Done!"
log "Full test log saved to: $LOG_FILE"

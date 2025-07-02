# LiveKit Demo Infrastructure

A production-ready Kubernetes infrastructure deployment on OpenStack using Terraform and ArgoCD for GitOps.

## 🏗️ Architecture

### Infrastructure Components
- **OpenStack Kubernetes Cluster**: Auto-scaling cluster with 3 master nodes and 3-10 worker nodes
- **Networking**: Private network (192.168.64.0/24) with Calico CNI
- **Storage**: Cinder volumes (100GB per node)
- **Load Balancing**: Master node load balancer with floating IP (54.38.149.147:6443)
- **SSL**: Let's Encrypt certificates for livekit-demo.cloudportal.app

### ArgoCD GitOps Platform
- **App-of-Apps Pattern**: Core services managed through ArgoCD
- **Auto-sync**: Enabled with prune and self-heal
- **Repository**: https://github.com/QumulusTechnology/livekit-demo.git
- **Access URL**: https://argocd.livekit-demo.cloudportal.app
- **Admin Credentials**: admin / XXkuUvnfO1cmmvTH (initial password)
- **Projects**: core-services project with cluster-wide permissions
- **Applications**: core-services (app-of-apps)

## 🚀 Quick Start

### Prerequisites
```bash
# Source environment configuration
source ~/livekit-demo-rc.sh

# Ensure SSH key exists
ls ~/.ssh/id_ed25519.pub
```

### Deploy Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Access ArgoCD
The ArgoCD UI is available at `https://argocd.livekit-demo.cloudportal.app`

**Login Credentials:**
- Username: `admin`
- Password: `XXkuUvnfO1cmmvTH`

**Alternative CLI Access:**
```bash
# Get the admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward for local access
kubectl port-forward service/argocd-server -n argocd 8080:443
```

## 📁 Project Structure

```
.
├── Claude.md                 # Project memory and instructions
├── README.md                 # This file
├── chart/                    # Helm charts for application deployment
│   ├── Chart.yaml           # Main chart metadata
│   ├── values.yaml          # Default values for all services
│   ├── templates/           # Kubernetes manifests
│   └── charts/              # Subcharts for individual services
│       ├── grafana/         # Grafana observability dashboard
│       ├── loki/            # Loki log aggregation
│       ├── mimir/           # Mimir metrics storage
│       ├── grafana-agent/   # Grafana Agent for metrics/logs collection
│       └── ...              # Additional service charts
└── terraform/
    ├── CLAUDE.md             # Terraform-specific memory
    ├── argocd.tf             # ArgoCD Helm deployment & app-of-apps
    ├── cluster.tf            # Kubernetes cluster configuration
    ├── data.tf               # Data sources
    ├── keypair.tf            # SSH key pair management
    ├── network.tf            # Network, subnet, and router
    ├── providers.tf          # Terraform providers (Kubernetes, Helm, kubectl)
    ├── template.tf           # Cluster template definition
    ├── terraform.tf          # Terraform configuration with pinned versions
    ├── variables.tf          # Input variables
    ├── run.sh               # Deployment script
    └── templates/
        └── argocd-values.yaml.tftpl  # ArgoCD Helm values template
```

## ⚙️ Configuration

### Key Variables
- **Domain**: `livekit-demo.cloudportal.app`
- **Kubernetes Version**: `v1.32.5-rancher1`
- **Node Flavors**: 
  - Master: `c1.medium`
  - Worker: `c1.xlarge`
- **Auto-scaling**: 3-10 nodes
- **Network CIDR**: `192.168.64.0/24`

### Cluster Features
- ✅ Auto-scaling enabled
- ✅ Auto-healing enabled
- ✅ Master load balancer
- ✅ Calico networking
- ✅ Cinder storage
- ✅ Docker overlay2 storage driver

## 🔐 Security

- SSH key-based access
- Private network with router to public network
- Let's Encrypt SSL certificates
- ArgoCD RBAC with core-services project

## 📊 Monitoring & Operations

The infrastructure includes a comprehensive observability stack deployed through ArgoCD:

### Deployed Services
- **Grafana**: Visualization dashboard for metrics and logs
- **Mimir**: Long-term metrics storage (Prometheus-compatible)
- **Loki**: Log aggregation and storage
- **Grafana Agent**: Unified agent for metrics and log collection

### Access Points
- **Grafana Dashboard**: https://grafana.livekit-demo.cloudportal.app
- **Mimir API**: https://mimir.livekit-demo.cloudportal.app
- **Loki API**: https://loki.livekit-demo.cloudportal.app

### Authentication
All services use HTTP Basic Auth with auto-generated credentials stored in Kubernetes secrets.

## 🛠️ Development

### Prerequisites for Development
1. OpenStack credentials configured
2. Terraform installed
3. kubectl configured (post-deployment)
4. Helm installed (for local chart development)

### Terraform Commands
```bash
# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy (when needed)
terraform destroy
```

## 📝 Notes

- Always source `~/trcoms-rc.sh` before Terraform operations
- The infrastructure uses OpenStack Container Infrastructure API
- ArgoCD manages applications through the core-services project
- Auto-scaling responds to cluster load automatically

## 🔧 ArgoCD Management

### Core Services Application
The `core-services` application uses the app-of-apps pattern to manage all platform services:

**Application Details:**
- **Name**: core-services
- **Project**: core-services  
- **Repository**: https://github.com/QumulusTechnology/livekit-demo.git
- **Path**: chart/
- **Sync Policy**: Automated with prune and self-heal enabled

### Managing Applications
```bash
# View applications
kubectl get applications -n argocd

# View application details
kubectl describe application core-services -n argocd

# Manual sync (if needed)
argocd app sync core-services
```

### Adding New Services
1. Create a new Helm chart in `chart/charts/your-service/`
2. Add the service to `chart/values.yaml`
3. Commit changes to Git
4. ArgoCD will automatically detect and deploy the new service

## 🤝 Contributing

This infrastructure follows GitOps principles:
- All changes made through Git commits
- ArgoCD automatically synchronizes changes
- Infrastructure managed via Terraform
- Applications managed via Helm charts and ArgoCD
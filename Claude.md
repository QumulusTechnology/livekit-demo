# LiveKit Demo - Infrastructure Project

## Project Overview
This repository contains infrastructure-as-code for deploying a Kubernetes platform on OpenStack with ArgoCD for GitOps deployment patterns. The infrastructure supports the LiveKit application with comprehensive observability and security.

## Technology Stack
- **Infrastructure:** OpenStack + Terraform
- **Orchestration:** Kubernetes (v1.32.5-rancher1)
- **GitOps:** ArgoCD with app-of-apps pattern
- **Networking:** Calico CNI
- **Storage:** Cinder volumes
- **Domain:** livekit-demo.cloudportal.app

## Architecture
### OpenStack Infrastructure
- **Cluster Template:** Auto-scaling Kubernetes cluster (3-10 nodes)
- **Master Nodes:** 3x c1.medium instances
- **Worker Nodes:** 3x c1.xlarge instances (auto-scaling enabled)
- **Network:** Private network (192.168.64.0/24) with router to public network
- **Storage:** 100GB Cinder volumes per node

### ArgoCD Configuration
- **Namespace:** argocd
- **Project:** core-services
- **Repository:** https://github.com/QumulusTechnology/livekit-demo.git
- **Auto-sync:** Enabled with prune and self-heal

## Development Approach
- Infrastructure as Code (Terraform)
- GitOps deployment patterns (ArgoCD)
- Helm charts for application deployment
- Auto-scaling and auto-healing enabled
- Let's Encrypt SSL certificates

## Prerequisites
- Source the environment file: `source ~/livekit-demo-rc.sh`
- SSH key pair available at ~/.ssh/id_ed25519.pub

## Claude Code Instructions
When working on this project:
1. Follow infrastructure-as-code best practices
2. Use Terraform for infrastructure provisioning
3. Implement GitOps patterns with ArgoCD
4. Ensure security and observability are built-in
5. Use modular, reusable components
6. Always source the environment file before Terraform operations

## Current Status
- ✅ **Infrastructure**: OpenStack Kubernetes cluster deployed with floating IP
- ✅ **Networking**: Private network (192.168.64.0/24) with Calico CNI
- ✅ **Load Balancer**: Master LB with floating IP (54.38.149.147:6443)
- ✅ **ArgoCD Platform**: Deployed with core-services app-of-apps pattern
- ✅ **Terraform Providers**: Kubernetes, Helm (2.17.0), kubectl configured
- ✅ **Auto-scaling**: Enabled (3-10 nodes)
- ✅ **SSL**: Let's Encrypt certificates configured

## ArgoCD Configuration
### Access & Authentication
- **URL**: https://argocd.livekit-demo.cloudportal.app
- **Admin Credentials**: admin / XXkuUvnfO1cmmvTH
- **Namespace**: argocd
- **Chart Version**: 8.1.2
- **Repository**: https://argoproj.github.io/argo-helm

### Core Services Application
- **Name**: core-services
- **Project**: core-services (cluster-wide permissions)
- **Repository**: https://github.com/QumulusTechnology/livekit-demo.git
- **Path**: chart/
- **Sync Policy**: Automated with prune and self-heal enabled
- **Status**: Healthy, Unknown sync (waiting for chart repository)

### Provider Configuration
- **Kubernetes Provider**: v2.37.1 with in-memory cluster credentials
- **Helm Provider**: v2.17.0 with kubernetes block configuration
- **kubectl Provider**: v1.19.0 with in-memory cluster credentials
- **Authentication**: Base64-decoded certificates from cluster kubeconfig

## Observability Stack
### Deployed Services (via ArgoCD)
- **Grafana**: Visualization dashboard
- **Mimir**: Prometheus-compatible metrics storage
- **Loki**: Log aggregation and storage
- **Grafana Agent**: Unified metrics/logs collection

### Access Points
- **Grafana**: https://grafana.livekit-demo.cloudportal.app
- **Mimir**: https://mimir.livekit-demo.cloudportal.app
- **Loki**: https://loki.livekit-demo.cloudportal.app

### Security
- HTTP Basic Auth with auto-generated passwords
- Credentials stored in Kubernetes secrets
- Let's Encrypt SSL certificates

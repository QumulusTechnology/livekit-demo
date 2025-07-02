# Terraform Project Memory

## Environment Setup
- Always run `source ~/livekit-demo-rc.sh` before executing terraform commands
- Cluster API accessible at: https://54.38.149.147:6443
- Kubeconfig available at: /tmp/config

## Provider Configuration
### Versions (Pinned)
- **terraform**: >= 1.12
- **openstack**: 2.1.0
- **helm**: 2.17.0 (downgraded from 3.0.2 for kubernetes block support)
- **kubectl**: 1.19.0
- **kubernetes**: 2.37.1
- **htpasswd**: 1.2.1

### Authentication Method
All Kubernetes-related providers use in-memory credentials from cluster kubeconfig:
```hcl
locals {
  kubeconfig = yamldecode(openstack_containerinfra_cluster_v1.k8s_cluster.kubeconfig.raw_config)
}

# Each provider configured with:
host                   = local.kubeconfig.clusters[0].cluster.server
cluster_ca_certificate = base64decode(local.kubeconfig.clusters[0].cluster["certificate-authority-data"])
client_certificate     = base64decode(local.kubeconfig.users[0].user["client-certificate-data"])
client_key             = base64decode(local.kubeconfig.users[0].user["client-key-data"])
```

## Cluster Configuration
- **Floating IP**: Enabled for master load balancer only (not all nodes)
- **Template Label**: `master_lb_floating_ip_enabled = "true"`
- **Auto-scaling**: 3-10 worker nodes
- **Health Status**: HEALTHY

## ArgoCD Deployment
- **Helm Release**: Imported and managed by Terraform
- **Import Command**: `terraform import helm_release.argocd argocd/argocd`
- **Values Template**: `templates/argocd-values.yaml.tftpl`
- **App-of-Apps**: Core services application configured

## Troubleshooting Notes
- Helm provider v3.x doesn't support kubernetes configuration block
- Use Helm provider v2.17.0 for proper kubernetes block support
- ArgoCD release must be imported if already exists
- Cluster template cannot be updated while cluster exists (requires destroy/recreate)
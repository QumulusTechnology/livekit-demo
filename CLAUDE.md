## Kubernetes Configuration
- Use KUBECONFIG ~/livekit-demo-k8s.config when connecting to kubernetes

## ArgoCD Workflow
- You need to push commit after every chart or services state and then do a hard refresh for that argocd-application for argocd to see it
- To refresh ArgoCD applications:
  ```bash
  # For a specific app
  KUBECONFIG=~/livekit-demo-k8s.config kubectl -n argocd patch app <app-name> --type merge -p '{"operation": {"initiatedBy": {"username": "admin"}, "sync": {"prune": true, "revision": "main"}}}'
  
  # Check sync status
  KUBECONFIG=~/livekit-demo-k8s.config kubectl -n argocd get app <app-name>
  ```

## Kubernetes Troubleshooting Guidelines
- **IMPORTANT**: Always perform troubleshooting steps when deploying or modifying services
- Always perform end-to-end testing after making configuration changes
- When troubleshooting issues:
  1. Check pod status with `KUBECONFIG=~/livekit-demo-k8s.config kubectl get pods -n [namespace]`
  2. Examine pod logs with `KUBECONFIG=~/livekit-demo-k8s.config kubectl logs -f [pod-name] -n [namespace]`
  3. Describe resources to see events: `KUBECONFIG=~/livekit-demo-k8s.config kubectl describe [resource] [name] -n [namespace]`
  4. Check ingress/service connectivity
  5. Verify certificates and TLS configuration
  6. Test actual functionality through browser/curl
- Common issue patterns:
  - cert-manager + nginx ingress: admission webhook pathType conflicts
  - ArgoCD sync issues: require hard refresh after config changes (see ArgoCD Workflow section)
  - Service connectivity: check ingress controller and DNS resolution
  - Pod CrashLoopBackOff: Always check logs immediately to identify configuration issues
  - Helm chart version mismatches: Verify chart versions exist in the repository
- Always validate that services are actually accessible and working, not just that pods are running
- **After any changes**: Commit, push, then refresh ArgoCD app and check pod status/logs
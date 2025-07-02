## Kubernetes Configuration
- Use KUBECONFIG ~/livekit-demo-k8s.config when connecting to kubernetes

## ArgoCD Workflow
- You need to push commit after every chart or services state and then do a hard refresh for that argocd-application for argocd to see it

## Kubernetes Troubleshooting Guidelines
- Always perform end-to-end testing after making configuration changes
- When troubleshooting issues:
  1. Check pod status with `kubectl get pods -A`
  2. Examine pod logs with `kubectl logs -f [pod-name] -n [namespace]`
  3. Describe resources to see events: `kubectl describe [resource] [name] -n [namespace]`
  4. Check ingress/service connectivity
  5. Verify certificates and TLS configuration
  6. Test actual functionality through browser/curl
- Common issue patterns:
  - cert-manager + nginx ingress: admission webhook pathType conflicts
  - ArgoCD sync issues: require hard refresh after config changes
  - Service connectivity: check ingress controller and DNS resolution
- Always validate that services are actually accessible and working, not just that pods are running
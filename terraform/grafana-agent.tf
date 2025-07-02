resource "kubectl_manifest" "grafana_agent_ns" {
  yaml_body = <<YAML
apiVersion: v1
kind: Namespace
metadata:
  name: grafana-agent
name: grafana-agent
YAML
}

resource "kubernetes_secret" "grafana_agent_credentials" {
  metadata {
    name      = "grafana-agent-credentials"
    namespace = "grafana-agent"
  }
  data = {
    "mimir_host"      = "https://mimir.${var.domain}"
    "mimir_password"  = random_password.mimir_password.result
    "mimir_username"  = "admin"
    "mimir_tenant_id" = "master"
    "loki_host"       = "https://gateway-loki.${var.domain}"
    "loki_password"   = random_password.loki_password.result
    "loki_username"   = "admin"
    "loki_tenant_id"  = "master"
  }
  type = "Opaque"
  depends_on = [
    kubectl_manifest.grafana_agent_ns
  ]
}

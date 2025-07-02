terraform {
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "2.1.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.17.0"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "1.19.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.37.1"
    }
    htpasswd = {
      source  = "loafoe/htpasswd"
      version = "1.2.1"
    }
  }
  required_version = ">= 1.12"
}

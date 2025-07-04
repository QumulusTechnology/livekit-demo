variable "kube_version" {
  description = "Kubernetes version for the cluster template"
  type        = string
  default     = "v1.32.5-rancher1"
}

variable "cluster_image_name" {
  description = "Name of the image for cluster nodes"
  type        = string
  default     = "Fedora-Core-Stable"
}

variable "keypair_name" {
  description = "Name of the keypair to create and use"
  type        = string
  default     = "k8s-cluster-keypair"
}

variable "external_network_name" {
  description = "Name of the external network"
  type        = string
  default     = "public"
}

variable "dns_nameserver" {
  description = "DNS nameserver for the cluster"
  type        = string
  default     = "8.8.8.8"
}

variable "dns_nameservers" {
  description = "DNS nameservers for the cluster"
  type        = list(string)
  default     = ["1.1.1.1", "8.8.8.8"]
}

variable "node_flavor_name" {
  description = "Name of the flavor for worker nodes"
  type        = string
  default     = "c1.xxlarge"
}

variable "master_flavor_name" {
  description = "Name of the flavor for master nodes"
  type        = string
  default     = "c1.medium"
}

variable "docker_volume_size" {
  description = "Size of the docker volume in GB"
  type        = number
  default     = 100
}

variable "min_node_count" {
  description = "Minimum number of nodes for auto-scaling"
  type        = number
  default     = 6
}

variable "max_node_count" {
  description = "Maximum number of nodes for auto-scaling"
  type        = number
  default     = 10
}

variable "public_key_path" {
  description = "Path to the public key file"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "cluster_name" {
  description = "Name of the Kubernetes cluster"
  type        = string
  default     = "k8s-cluster"
}

variable "master_count" {
  description = "Number of master nodes"
  type        = number
  default     = 3
}

variable "node_count" {
  description = "Number of worker nodes"
  type        = number
  default     = 3
}

variable "cluster_subnet_cidr" {
  description = "CIDR block for the cluster subnet"
  type        = string
  default     = "192.168.64.0/24"
}

variable "domain" {
  type    = string
  default = "livekit-demo.cloudportal.app"
}

variable "letsencrypt_email" {
  type        = string
  default     = "livekit-demo@letsencrypt.cloudportal.app"
  description = "email address used for letsencrypt cert request"
}

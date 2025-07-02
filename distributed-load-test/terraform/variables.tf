variable "instance_count" {
  description = "Number of load test VMs to create"
  type        = number
  default     = 10
}

variable "instance_flavor" {
  description = "OpenStack flavor for load test VMs"
  type        = string
  default     = "c1.large"  # 4 vCPUs, 8GB RAM
}

variable "image_name" {
  description = "Ubuntu Noble image name"
  type        = string
  default     = "Ubuntu-24.04-Noble"
}

variable "key_pair_name" {
  description = "SSH key pair name"
  type        = string
  default     = "livekit-demo"
}

variable "network_name" {
  description = "Network to attach VMs to"
  type        = string
  default     = "internal"
}

variable "security_group_name" {
  description = "Security group for load test VMs"
  type        = string
  default     = "load-test-sg"
}

variable "livekit_url" {
  description = "LiveKit WebSocket URL"
  type        = string
  default     = "wss://ws.livekit-demo.cloudportal.app"
}

variable "test_duration" {
  description = "Duration of each load test"
  type        = string
  default     = "5m"
}

variable "participants_per_vm" {
  description = "Number of participants each VM should simulate"
  type        = number
  default     = 100
}

variable "video_resolution" {
  description = "Video resolution for testing (low, medium, high)"
  type        = string
  default     = "medium"
}
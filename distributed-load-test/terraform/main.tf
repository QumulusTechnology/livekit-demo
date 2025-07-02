terraform {
  required_version = ">= 1.0"
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 1.53.0"
    }
  }
}

provider "openstack" {
  # Uses environment variables from livekit-demo-rc.sh
}

# Data source for Ubuntu Noble image
data "openstack_images_image_v2" "ubuntu_noble" {
  name        = var.image_name
  most_recent = true
}

# Data source for existing network
data "openstack_networking_network_v2" "load_test_network" {
  name = var.network_name
}

# Create security group for load test VMs
resource "openstack_networking_secgroup_v2" "load_test" {
  name        = var.security_group_name
  description = "Security group for LiveKit load test VMs"
}

# Allow SSH
resource "openstack_networking_secgroup_rule_v2" "ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.load_test.id
}

# Allow ICMP (ping)
resource "openstack_networking_secgroup_rule_v2" "icmp" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "icmp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.load_test.id
}

# Allow all outbound traffic
# Note: OpenStack security groups allow all egress traffic by default
# resource "openstack_networking_secgroup_rule_v2" "egress" {
#   direction         = "egress"
#   ethertype         = "IPv4"
#   security_group_id = openstack_networking_secgroup_v2.load_test.id
# }

# Create or use existing keypair
resource "openstack_compute_keypair_v2" "load_test_keypair" {
  name       = "${var.key_pair_name}-loadtest"
  public_key = file("~/.ssh/id_ed25519.pub")
}

# Create load test VMs
resource "openstack_compute_instance_v2" "load_test_vm" {
  count           = var.instance_count
  name            = format("livekit-loadtest-%02d", count.index + 1)
  image_id        = data.openstack_images_image_v2.ubuntu_noble.id
  flavor_name     = var.instance_flavor
  key_pair        = openstack_compute_keypair_v2.load_test_keypair.name
  security_groups = [openstack_networking_secgroup_v2.load_test.name]

  network {
    uuid = data.openstack_networking_network_v2.load_test_network.id
  }

  metadata = {
    group = "livekit-load-test"
    index = count.index
  }

  user_data = templatefile("${path.module}/cloud-init.yaml", {
    vm_index = count.index
    vm_name  = format("livekit-loadtest-%02d", count.index + 1)
  })
}

# Create floating IPs for each VM
resource "openstack_networking_floatingip_v2" "load_test_fip" {
  count = var.instance_count
  pool  = "public"
}

# Associate floating IPs with VMs
resource "openstack_compute_floatingip_associate_v2" "load_test_fip" {
  count       = var.instance_count
  floating_ip = openstack_networking_floatingip_v2.load_test_fip[count.index].address
  instance_id = openstack_compute_instance_v2.load_test_vm[count.index].id
}

# Generate Ansible inventory
resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory.ini"
  content = templatefile("${path.module}/inventory.tpl", {
    vms = [for i in range(var.instance_count) : {
      name       = format("livekit-loadtest-%02d", i + 1)
      private_ip = openstack_compute_instance_v2.load_test_vm[i].access_ip_v4
      public_ip  = openstack_networking_floatingip_v2.load_test_fip[i].address
      index      = i
    }]
  })
}

# Generate test configuration
resource "local_file" "test_config" {
  filename = "${path.module}/../ansible/test-config.yml"
  content = templatefile("${path.module}/test-config.tpl", {
    livekit_url          = var.livekit_url
    test_duration        = var.test_duration
    participants_per_vm  = var.participants_per_vm
    video_resolution     = var.video_resolution
    total_vms           = var.instance_count
    total_participants  = var.instance_count * var.participants_per_vm
  })
}

# Output information
output "load_test_vms" {
  value = {
    for i in range(var.instance_count) : format("livekit-loadtest-%02d", i + 1) => {
      private_ip = openstack_compute_instance_v2.load_test_vm[i].access_ip_v4
      public_ip  = openstack_networking_floatingip_v2.load_test_fip[i].address
    }
  }
}

output "ansible_inventory_path" {
  value = local_file.ansible_inventory.filename
}

output "total_participants" {
  value = var.instance_count * var.participants_per_vm
}
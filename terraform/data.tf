data "openstack_compute_flavor_v2" "node_flavor" {
  name = var.node_flavor_name
}

data "openstack_compute_flavor_v2" "master_flavor" {
  name = var.master_flavor_name
}

data "openstack_networking_network_v2" "external_network" {
  name = var.external_network_name
}

data "openstack_images_image_v2" "cluster_image" {
  name        = var.cluster_image_name
  most_recent = true
}
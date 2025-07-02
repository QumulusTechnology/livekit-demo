resource "openstack_containerinfra_cluster_v1" "k8s_cluster" {
  name                = var.cluster_name
  cluster_template_id = openstack_containerinfra_clustertemplate_v1.k8s_template.id
  master_count        = var.master_count
  node_count          = var.node_count
  keypair             = openstack_compute_keypair_v2.cluster_keypair.name
  fixed_network       = openstack_networking_network_v2.cluster_network.id
  fixed_subnet        = openstack_networking_subnet_v2.cluster_subnet.id
  floating_ip_enabled = true

  depends_on = [
    openstack_networking_router_interface_v2.cluster_router_interface
  ]

  lifecycle {
    ignore_changes = [labels, node_count]
  }
}

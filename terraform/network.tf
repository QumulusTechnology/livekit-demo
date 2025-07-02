resource "openstack_networking_network_v2" "cluster_network" {
  name = "${var.cluster_name}-network"
}

resource "openstack_networking_subnet_v2" "cluster_subnet" {
  name            = "${var.cluster_name}-subnet"
  network_id      = openstack_networking_network_v2.cluster_network.id
  cidr            = var.cluster_subnet_cidr
  dns_nameservers = var.dns_nameservers
}

resource "openstack_networking_router_v2" "cluster_router" {
  name                = "${var.cluster_name}-router"
  admin_state_up      = true
  external_network_id = data.openstack_networking_network_v2.external_network.id
}

resource "openstack_networking_router_interface_v2" "cluster_router_interface" {
  router_id = openstack_networking_router_v2.cluster_router.id
  subnet_id = openstack_networking_subnet_v2.cluster_subnet.id
}

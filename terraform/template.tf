resource "openstack_containerinfra_clustertemplate_v1" "k8s_template" {
  name                  = "k8s-${replace(replace(var.kube_version, "v", ""), "-rancher1", "")}"
  image                 = data.openstack_images_image_v2.cluster_image.name
  keypair_id            = openstack_compute_keypair_v2.cluster_keypair.name
  external_network_id   = data.openstack_networking_network_v2.external_network.id
  dns_nameserver        = var.dns_nameserver
  flavor                = data.openstack_compute_flavor_v2.node_flavor.name
  master_flavor         = data.openstack_compute_flavor_v2.master_flavor.name
  docker_volume_size    = var.docker_volume_size
  network_driver        = "calico"
  volume_driver         = "cinder"
  docker_storage_driver = "overlay2"
  coe                   = "kubernetes"
  server_type           = "vm"
  master_lb_enabled     = true

  labels = {
    kube_tag                      = var.kube_version
    auto_healing_enabled          = "true"
    auto_scaling_enabled          = "true"
    min_node_count                = tostring(var.min_node_count)
    max_node_count                = tostring(var.max_node_count)
    master_lb_floating_ip_enabled = "true"
  }
}

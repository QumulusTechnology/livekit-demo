resource "openstack_compute_keypair_v2" "cluster_keypair" {
  name       = var.keypair_name
  public_key = file(var.public_key_path)
}
terraform {
  backend "s3" {
    bucket       = "qumulus-tfstate-dev"
    key          = "livekit-demo/terraform.tfstate"
    region       = "eu-west-2"
    profile      = "qcp_dev"
    use_lockfile = true
    encrypt      = true
  }
}

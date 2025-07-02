#!/bin/bash

# Auto-source OpenStack credentials and run terraform
source ~/livekit-demo-rc.sh

# Run terraform with all passed arguments
terraform "$@"
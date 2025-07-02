[load_test_vms]
%{ for vm in vms ~}
${vm.name} ansible_host=${vm.public_ip} ansible_user=ubuntu vm_index=${vm.index} private_ip=${vm.private_ip}
%{ endfor ~}

[load_test_vms:vars]
ansible_python_interpreter=/usr/bin/python3
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
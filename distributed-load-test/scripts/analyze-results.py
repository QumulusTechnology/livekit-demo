#!/usr/bin/env python3
"""
Analyze distributed load test results and generate detailed report
"""

import json
import os
import sys
import glob
import statistics
from datetime import datetime
import argparse

def parse_livekit_log(log_file):
    """Extract metrics from LiveKit CLI output"""
    metrics = {
        'bandwidth': None,
        'packet_loss': None,
        'connections': None,
        'success_rate': None
    }
    
    try:
        with open(log_file, 'r') as f:
            content = f.read()
            
        # Look for summary lines (adjust patterns based on actual output)
        for line in content.split('\n'):
            if 'Total' in line and 'mbps' in line:
                # Extract bandwidth
                try:
                    bandwidth_str = line.split('mbps')[0].split()[-1]
                    metrics['bandwidth'] = float(bandwidth_str)
                except:
                    pass
            
            if 'Packet Loss' in line or '%' in line:
                # Extract packet loss
                try:
                    for word in line.split():
                        if '%' in word:
                            metrics['packet_loss'] = float(word.strip('%'))
                            break
                except:
                    pass
    except Exception as e:
        print(f"Error parsing {log_file}: {e}")
    
    return metrics

def analyze_vm_results(results_dir):
    """Analyze results from a single VM"""
    vm_data = {
        'metrics': {},
        'system_stats': {},
        'test_result': {}
    }
    
    # Read test result JSON
    result_file = os.path.join(results_dir, 'results', 'test-result.json')
    if os.path.exists(result_file):
        with open(result_file, 'r') as f:
            vm_data['test_result'] = json.load(f)
    
    # Read packet loss
    packet_loss_file = os.path.join(results_dir, 'results', 'packet-loss.txt')
    if os.path.exists(packet_loss_file):
        with open(packet_loss_file, 'r') as f:
            vm_data['metrics']['packet_loss'] = float(f.read().strip())
    
    # Parse LiveKit output
    log_files = glob.glob(os.path.join(results_dir, 'logs', 'livekit-output.log'))
    if log_files:
        lk_metrics = parse_livekit_log(log_files[0])
        vm_data['metrics'].update(lk_metrics)
    
    # Read system metrics
    metrics_files = glob.glob(os.path.join(results_dir, 'metrics', 'system-metrics-*.jsonl'))
    if metrics_files:
        cpu_values = []
        memory_values = []
        
        with open(metrics_files[0], 'r') as f:
            for line in f:
                try:
                    metric = json.loads(line)
                    cpu_values.append(metric['cpu_percent'])
                    memory_values.append(metric['memory']['percent'])
                except:
                    pass
        
        if cpu_values:
            vm_data['system_stats']['avg_cpu'] = statistics.mean(cpu_values)
            vm_data['system_stats']['max_cpu'] = max(cpu_values)
        
        if memory_values:
            vm_data['system_stats']['avg_memory'] = statistics.mean(memory_values)
            vm_data['system_stats']['max_memory'] = max(memory_values)
    
    return vm_data

def generate_summary(all_results):
    """Generate summary statistics from all VMs"""
    summary = {
        'total_vms': len(all_results),
        'successful_vms': 0,
        'total_participants': 0,
        'metrics': {
            'bandwidth': [],
            'packet_loss': [],
            'cpu_usage': [],
            'memory_usage': []
        }
    }
    
    for vm_id, data in all_results.items():
        # Count successful VMs
        if data['test_result'].get('exit_code', 1) == 0:
            summary['successful_vms'] += 1
        
        # Total participants
        if 'participants' in data['test_result']:
            summary['total_participants'] += data['test_result']['participants']['total']
        
        # Collect metrics
        if data['metrics'].get('bandwidth'):
            summary['metrics']['bandwidth'].append(data['metrics']['bandwidth'])
        
        if data['metrics'].get('packet_loss') is not None:
            summary['metrics']['packet_loss'].append(data['metrics']['packet_loss'])
        
        if data['system_stats'].get('avg_cpu'):
            summary['metrics']['cpu_usage'].append(data['system_stats']['avg_cpu'])
        
        if data['system_stats'].get('avg_memory'):
            summary['metrics']['memory_usage'].append(data['system_stats']['avg_memory'])
    
    # Calculate aggregates
    aggregates = {}
    for metric, values in summary['metrics'].items():
        if values:
            aggregates[metric] = {
                'min': min(values),
                'max': max(values),
                'avg': statistics.mean(values),
                'median': statistics.median(values)
            }
    
    summary['aggregates'] = aggregates
    
    return summary

def main():
    parser = argparse.ArgumentParser(description='Analyze distributed load test results')
    parser.add_argument('--results-dir', default='../results', 
                        help='Directory containing test results')
    parser.add_argument('--output', default='analysis-report.json',
                        help='Output file for analysis report')
    
    args = parser.parse_args()
    
    print("Analyzing distributed load test results...")
    
    # Extract and analyze results from each VM
    all_results = {}
    
    for i in range(10):  # Assuming 10 VMs
        vm_results_archive = os.path.join(args.results_dir, f'vm-{i}-results.tar.gz')
        if os.path.exists(vm_results_archive):
            # Extract archive
            extract_dir = os.path.join(args.results_dir, f'vm-{i}-extracted')
            os.makedirs(extract_dir, exist_ok=True)
            
            os.system(f'tar -xzf {vm_results_archive} -C {extract_dir}')
            
            # Analyze VM results
            vm_data = analyze_vm_results(extract_dir)
            all_results[f'vm-{i}'] = vm_data
            
            print(f"Analyzed VM {i}: {len(vm_data['metrics'])} metrics found")
    
    # Generate summary
    summary = generate_summary(all_results)
    
    # Create final report
    report = {
        'timestamp': datetime.now().isoformat(),
        'summary': summary,
        'vm_results': all_results
    }
    
    # Save report
    with open(args.output, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nAnalysis complete. Report saved to {args.output}")
    
    # Print summary
    print("\n=== SUMMARY ===")
    print(f"Total VMs: {summary['total_vms']}")
    print(f"Successful VMs: {summary['successful_vms']}")
    print(f"Total Participants: {summary['total_participants']}")
    
    if summary['aggregates']:
        print("\nPerformance Metrics:")
        for metric, stats in summary['aggregates'].items():
            print(f"\n{metric.replace('_', ' ').title()}:")
            print(f"  Average: {stats['avg']:.2f}")
            print(f"  Min: {stats['min']:.2f}")
            print(f"  Max: {stats['max']:.2f}")

if __name__ == '__main__':
    main()
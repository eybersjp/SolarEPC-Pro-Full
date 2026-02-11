import json
import sys
import os

def compare_results(current_path, baseline_path, threshold=0.1):
    """Compare current performance results against baseline"""
    if not os.path.exists(current_path):
        print(f"Current results not found at {current_path}")
        return False
        
    if not os.path.exists(baseline_path):
        print(f"Baseline not found at {baseline_path}. Saving current as baseline.")
        with open(current_path, 'r') as f_curr:
            curr_data = json.load(f_curr)
        with open(baseline_path, 'w') as f_base:
            json.dump(curr_data, f_base, indent=2)
        return True

    with open(current_path, 'r') as f_curr:
        current = {r['test_name']: r for r in json.load(f_curr)}
        
    with open(baseline_path, 'r') as f_base:
        baseline = {r['test_name']: r for r in json.load(f_base)}
        
    regressions = []
    print("\nPerformance Comparison:")
    print("-" * 80)
    print(f"{'Test Case':<40} | {'Baseline (s)':<12} | {'Current (s)':<12} | {'Change %'}")
    print("-" * 80)
    
    for name, curr_data in current.items():
        if name in baseline:
            base_time = baseline[name]['execution_time']
            curr_time = curr_data['execution_time']
            diff = (curr_time - base_time) / base_time if base_time > 0 else 0
            
            status = ""
            if diff > threshold:
                status = "!!! REGRESSION !!!"
                regressions.append(name)
            elif diff < -threshold:
                status = "+++ IMPROVEMENT +++"
                
            print(f"{name:<40} | {base_time:<12.3f} | {curr_time:<12.3f} | {diff:>8.1%} {status}")
        else:
            print(f"{name:<40} | {'N/A':<12} | {curr_data['execution_time']:<12.3f} | NEW")
            
    print("-" * 80)
    
    if regressions:
        print(f"\nFound {len(regressions)} performance regressions (> {threshold:.0%})")
        return False
    else:
        print("\nNo significant performance regressions detected.")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        curr = "benchmarks/latest_run.json"
        base = "benchmarks/baseline.json"
    else:
        curr = sys.argv[1]
        base = sys.argv[2]
        
    success = compare_results(curr, base)
    sys.exit(0 if success else 1)

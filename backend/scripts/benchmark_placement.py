import os
import json
import time
import subprocess
import sys

def run_benchmarks():
    """Run performance tests and capture structured output"""
    print("Running placement benchmarks...")
    
    # Ensure benchmarks directory exists
    os.makedirs("benchmarks", exist_ok=True)
    
    report_path = "benchmarks/benchmark_results.json"
    env = os.environ.copy()
    env["PERFORMANCE_REPORT_PATH"] = report_path
    
    try:
        subprocess.run(
            ["pytest", "tests/test_performance_placement.py", "-m", "performance", "-v"],
            env=env,
            check=True
        )
        
        with open(report_path, "r") as f:
            results = json.load(f)
            
        print("\nBenchmark Summary:")
        print("-" * 60)
        print(f"{'Test Case':<40} | {'Modules':<8} | {'Time (s)':<8}")
        print("-" * 60)
        
        for result in results:
            print(f"{result['test_name']:<40} | {result['modules']:<8} | {result['execution_time']:<8.3f}")
            
        print("-" * 60)
        return results
        
    except subprocess.CalledProcessError as e:
        print(f"Error running benchmarks: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

if __name__ == "__main__":
    run_benchmarks()

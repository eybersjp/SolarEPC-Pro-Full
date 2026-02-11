#!/bin/bash
# Script to run backend performance tests with structured reporting

# Set environment variable for the report path
export PERFORMANCE_REPORT_PATH="benchmarks/latest_run.json"

echo "Starting backend performance tests..."
pytest tests/test_performance_placement.py -v -m performance --color=yes

if [ $? -eq 0 ]; then
    echo "Performance tests completed successfully."
    echo "Results saved to backend/$PERFORMANCE_REPORT_PATH"
else
    echo "Performance tests failed or did not meet thresholds."
    exit 1
fi

import json
import os
import sys

def generate_dashboard(report_path="benchmarks/latest_run.json", output_path="benchmarks/dashboard.html"):
    """Generate a simple HTML dashboard from performance metrics"""
    if not os.path.exists(report_path):
        print(f"Report not found at {report_path}")
        return

    with open(report_path, 'r') as f:
        metrics = json.load(f)

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SolarEPC-Pro Performance Dashboard</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f4f7f6; }}
        h1, h2 {{ color: #2c3e50; }}
        .card {{ background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        .status-ok {{ color: #27ae60; font-weight: bold; }}
        .status-warn {{ color: #e67e22; font-weight: bold; }}
        .status-fail {{ color: #c0392b; font-weight: bold; }}
        .metric-value {{ font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-weight: bold; }}
        .timestamp {{ font-size: 0.8em; color: #7f8c8d; }}
    </style>
</head>
<body>
    <h1>SolarEPC-Pro Performance Dashboard</h1>
    <p class="timestamp">Generated on: {metrics[0]['timestamp'] if metrics else 'N/A'}</p>

    <div class="card">
        <h2>Backend Placement Algorithm</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Case</th>
                    <th>Modules</th>
                    <th>Execution Time</th>
                    <th>Throughput</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """

    for m in metrics:
        # Simple status logic
        status = "status-ok"
        status_text = "PASS"
        if m['execution_time'] > 5.0:
            status = "status-fail"
            status_text = "SLOW"
        
        throughput = f"{m.get('modules_per_second', 0):.1f} mod/s"
        
        html_content += f"""
                <tr>
                    <td>{m['test_name']}</td>
                    <td>{m['modules']}</td>
                    <td class="metric-value">{m['execution_time']:.3f}s</td>
                    <td class="metric-value">{throughput}</td>
                    <td class="{status}">{status_text}</td>
                </tr>
        """

    html_content += """
            </tbody>
        </table>
    </div>

    <div class="card">
        <h2>System Information</h2>
        <ul>
            <li><strong>Environment:</strong> Development/Testing</li>
            <li><strong>Data Source:</strong> benchmarks/latest_run.json</li>
        </ul>
    </div>
</body>
</html>
    """

    with open(output_path, 'w') as f:
        f.write(html_content)
    
    print(f"Dashboard generated at {output_path}")

if __name__ == "__main__":
    generate_dashboard()

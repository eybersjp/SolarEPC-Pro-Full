# Performance Testing Guide

This guide provides patterns and best practices for writing and maintaining performance tests in SolarEPC-Pro.

## Backend Performance Testing

### Patterns

1. **Structured Metrics**: Always use the `PerformanceMetrics` dataclass to collect data.
2. **Setup Isolation**: Use fixtures for site creation to avoid measuring setup time.
3. **Parametrization**: Test multiple site sizes (100, 500, 1000, 2000, 5000 modules).
4. **Assertions**: Use thresholds based on site size (e.g., <2s for 1000 modules).

### Example Test

```python
def test_new_algorithm_performance(performance_metrics):
    start = time.time()
    # ... execution ...
    elapsed = time.time() - start
    
    performance_metrics.add(PerformanceMetrics(
        test_name="new_algo",
        modules=num_modules,
        execution_time=elapsed
    ))
    assert elapsed < 1.0
```

## Frontend Performance Testing

### Measuring Render Time

Use `performance.now()` or the `measureRenderTime` utility:

```typescript
const start = performance.now();
render(<MyComponent />);
const end = performance.now();
console.log(`Render time: ${end - start}ms`);
```

### Debounce Testing

Always use `vi.useFakeTimers()` to test debounced operations accurately without waiting for real time.

## Avoiding Flakiness

1. **Run Multiple Iterations**: For highly variable tests, run 3x and take the median.
2. **Isolate Environment**: Avoid running performance tests while other heavy processes are active.
3. **Clear Caches**: Ensure a clean state before each run.

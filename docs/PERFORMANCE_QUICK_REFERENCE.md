# Performance Testing Quick Reference

## Run All Performance Tests

```bash
# Backend
cd backend && ./scripts/run_performance_tests.sh

# Frontend
cd frontend && npm run test:performance
```

## Compare with Baseline

```bash
# Backend
python backend/scripts/compare_performance.py

# Frontend
npm run test:performance:report && npx ts-node frontend/scripts/compare-benchmarks.ts
```

## Update Baselines

```bash
# Backend
cp backend/benchmarks/latest_run.json backend/benchmarks/baseline.json

# Frontend
npm run test:performance:baseline
```

## Common Metrics

- **Small Site (<1k mod)**: < 2s
- **Large Site (>1k mod)**: Async
- **Render (2k mod)**: < 500ms
- **Debounce**: 30s

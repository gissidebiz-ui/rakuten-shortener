# CI/CD Pipeline Configuration (Phase 5)

## Overview

This directory contains GitHub Actions workflows for automated testing, code quality checks, and pipeline validation.

## Workflows

### 1. **tests.yml** - Unit Tests & Type Checking
- **Trigger**: Push to `main` or PR to `main` (when `src/` or `tests/` change)
- **Matrix**: Python 3.11, 3.12
- **Checks**:
  - pytest unit tests with coverage
  - mypy type checking (4 core modules)
  - py_compile syntax validation
  - codecov coverage reports
- **Status**: ✓ Continues on error (warning-level checks)

### 2. **validate-pipeline.yml** - Pipeline Integration Test
- **Trigger**: Push to `main` or PR to `main` (when `src/` or `config/` change)
- **Runtime**: Python 3.12, 30-minute timeout
- **Checks**:
  - Module file existence validation
  - Import structure validation
  - DI container instantiation test
  - Python syntax verification
- **Purpose**: Ensures pipeline components work together

### 3. **lint.yml** - Code Quality & Linting
- **Trigger**: Push to `main` or PR to `main` (when `src/` change)
- **Tools**:
  - black (code formatting)
  - isort (import ordering)
  - flake8 (syntax validation)
  - pylint (code quality metrics)
- **Status**: ✓ Continues on error (informational-level checks)

## Architecture

```
.github/workflows/
├── tests.yml              # Unit tests + type checking
├── validate-pipeline.yml  # Integration test
└── lint.yml              # Code quality checks
```

## GitHub Secrets Required

For production deployment, add these secrets to GitHub repository settings:

- `GOOGLE_API_KEY`: Google Generative AI API key
- `GITHUB_TOKEN`: GitHub API token (auto-provided by Actions)

## Local Testing

Test workflows locally before pushing:

```bash
# Install act (GitHub Actions local runner)
# Windows: choco install act-cli
# macOS: brew install act

# Run specific workflow
act -j test -l

# Run all workflows
act -l
```

## Integration with Development

### Adding New Tests
1. Create test file in `tests/`
2. Workflows auto-detect and run
3. Coverage reports generated

### Failing Tests
1. Fix locally: `python -m pytest tests/ -v`
2. Pre-commit: `python -m mypy src/ --ignore-missing-imports`
3. Push: Workflows verify again

### Skipping Workflow Triggers

Add `[skip ci]` to commit message:
```bash
git commit -m "docs: update README [skip ci]"
```

## Performance

| Workflow | Avg Duration | Matrix Jobs |
|----------|-------------|------------|
| tests.yml | 2-3 min | 2 (3.11, 3.12) |
| validate-pipeline.yml | 1-2 min | 1 |
| lint.yml | 1 min | 1 |
| **Total** | ~4-6 min | - |

## Conventions

- All workflows use `continue-on-error: true` for informational checks
- Only syntax validation (py_compile) blocks merging
- Coverage reports uploaded only for Python 3.12
- Workflows respect path-based triggers for efficiency

## Next Phases

- Phase 6: Automated deployment (conditional on test success)
- Phase 7: Release automation (tag-based)
- Phase 8: Performance benchmarking (weekly)

## Reference

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [act - Run GitHub Actions locally](https://github.com/nektos/act)

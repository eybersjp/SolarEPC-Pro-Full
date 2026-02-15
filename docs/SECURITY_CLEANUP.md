# Security Cleanup Guide

## 1. Remove Sensitive Files from Git History

We need to remove `.env` files that may have been committed. We use [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) for this.

### Prerequisites

- Java Runtime Environment (JRE)
- BFG Repo-Cleaner (`bfg.jar`)

### Steps

1. **Clone a fresh mirror of the repo**:

    ```bash
    git clone --mirror https://github.com/eybersjp/SolarEPC-Pro-Full.git solarepc-pro-backup.git
    ```

2. **Run BFG**:

    ```bash
    java -jar bfg.jar --delete-files .env
    java -jar bfg.jar --delete-files .env.local
    java -jar bfg.jar --delete-files *.env
    ```

3. **Clean and Force Push**:

    ```bash
    cd solarepc-pro-backup.git
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    git push --force
    ```

4. **Team Action**:
    All team members must delete their local copies and clone the fresh repo.

## 2. Rotate Secrets

Since `.env` files were in history, all secrets within them are compromised.

### Action Items

1. **Database**: Change `POSTGRES_PASSWORD`.
2. **PVWatts**: Generate new API key from [NREL](https://developer.nrel.gov/signup/).
3. **Firebase**: Generate new Private Key JSON in Firebase Console.
4. **App Secret**: Generate new `SECRET_KEY` (e.g., `openssl rand -hex 32`).
5. **Redis**: Change Redis password if exposed.

## 3. Verify

After cleanup, run:

```bash
git log --all --full-history -- "**/.env"
```

It should return no results.

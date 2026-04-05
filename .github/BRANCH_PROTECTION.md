# Branch Protection Rules for `main`

Recommended branch protection settings for the `main` branch.
Apply these via **Settings > Branches > Branch protection rules > Add rule** for `main`.

## Required Settings

### Require a pull request before merging
- Enable **Require a pull request before merging**
- Set **Required number of approvals before merging** to at least **1**
- Enable **Dismiss stale pull request approvals when new commits are pushed**

### Require status checks to pass before merging
- Enable **Require status checks to pass before merging**
- Add the following required status checks:
  - `quality` (the CI lint/types/tests/build job)
  - `security` (the CodeQL scanning job)
- Enable **Require branches to be up to date before merging**

### Restrict force pushes
- Enable **Do not allow force pushes** to `main`

### Restrict deletions
- Enable **Do not allow deletion** of `main`

## Optional but Recommended

- **Require signed commits** -- ensures all commits are GPG-signed
- **Require linear history** -- enforces squash or rebase merging for a clean history
- **Include administrators** -- apply these rules to repository admins as well
- **Restrict who can push to matching branches** -- limit direct push access to specific teams or automation accounts

## Applying via GitHub CLI

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["quality", "security"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

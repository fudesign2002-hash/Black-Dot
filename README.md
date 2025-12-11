<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Uqc_LDgzoFJilBq--qzBfHFoVFW9_79_

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Convenience: Commit and push with a single command

This repo includes a helper script `scripts/c.sh` which commits and optionally pushes changes.

- Usage examples:
  - Commit: `npm run c -- "修正"`
  - Commit and push: `npm run c -- "修正" p`

- Quick setup to call `c` directly from your shell, add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Add to PATH for current terminal session
export PATH="$PATH:$(pwd)/scripts"

# Or create an alias (permanent in ~/.bashrc or ~/.zshrc)
alias c="bash $(pwd)/scripts/c.sh"
```

After that, run:

```
# Commit only
c "修正"
# Commit and push
c "修正" p
```
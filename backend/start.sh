#!/bin/bash
set -e

# Install uv if not already installed
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Ensure uv is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Sync dependencies (only if needed, or skip if already synced in build)
if [ ! -d ".venv" ]; then
    uv sync --frozen
fi

# Run the application using the full path to uv if needed
if command -v uv &> /dev/null; then
    uv run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
else
    # Fallback: use the installed uv directly
    "$HOME/.cargo/bin/uv" run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
fi


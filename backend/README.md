# Backend - EthicalBank

## Description

Backend service for the EthicalBank application. GHCI Hackathon 2025.

## Requirements

- Python 3.11 or higher
- uv package manager

## Installation

### Install uv

Follow the official [uv installation guide](https://docs.astral.sh/uv/getting-started/installation/)

**On macOS with Homebrew:**
```bash
brew install uv
```

**On Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**On Windows:**
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Setup Project

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and install dependencies:
```bash
uv sync
```

This command will:
- Create a virtual environment
- Install all dependencies from `pyproject.toml`
- Lock the dependency versions in `uv.lock`

## Running the Application

Start the server:
```bash
uv run python main.py
```

## Development

### Adding Dependencies

Add a new dependency:
```bash
uv add <package-name>
```

Add a development-only dependency:
```bash
uv add --dev <package-name>
```

### Updating Dependencies

Update all dependencies to latest compatible versions:
```bash
uv sync --upgrade
```

Update a specific package:
```bash
uv pip install --upgrade <package-name>
```

### Viewing Installed Packages

List all installed packages:
```bash
uv pip list
```

## Project Structure

```
backend/
├── main.py              # Main application entry point
├── pyproject.toml       # Project configuration and dependencies
├── uv.lock              # Dependency lock file (auto-generated)
└── README.md            # This file
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `uv sync` | Install dependencies in virtual environment |
| `uv run` | Run a Python module or script |
| `uv add <pkg>` | Add a dependency |
| `uv add --dev <pkg>` | Add a development dependency |
| `uv pip list` | List installed packages |
| `uv venv` | Create/manage virtual environment |

## Troubleshooting

### Virtual environment not activated

If you get "command not found" errors, ensure you are in the backend directory:
```bash
cd backend
```

### Dependency conflicts

If you encounter dependency issues, try:
```bash
uv sync --reinstall
```

Clear cache and resync:
```bash
rm uv.lock
uv sync
```

### Python version mismatch

Verify Python version:
```bash
python --version
```

The project requires Python 3.11 or higher. Update if needed or use uv's Python management:
```bash
uv python install 3.11
```

## Links

- [uv Documentation](https://docs.astral.sh/uv/)
- [Python Documentation](https://docs.python.org/3/)

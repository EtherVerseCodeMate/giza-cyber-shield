# Pip requirements

The files here are kept up-to-date with `pyproject.toml`. The recommended dev environment uses `pdm` but on legacy systems and older versions of Python a simple pip+venv setup may be needed.

* `requirements-dev.txt` - Development, linting, testing, packaging
* `requirements.txt` - App requirements
* `requirements-legacy.txt` - Requirements for running on Windows 7 and other older OS'

## Example Setup

```
python -m venv ./.venv

# Linux
source ./.venv/bin/activate

# Windows
.\.venv\Scripts\Activate.ps1

# Modern OS'
pip install -r requirements/requirements-dev.txt -r requirements/requirements.txt

# Older OS'
pip install -r requirements/requirements-legacy.txt
```
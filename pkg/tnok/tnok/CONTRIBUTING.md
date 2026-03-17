# Development Environment Setup

_Latest tested Python: 3.12_

1. (Windows only) Download and install the latest version of the npcap driver: https://npcap.com/
    * _This is required for both the tnok client and tnokd server_
1. Get `pdm` installed and on the path: https://github.com/pdm-project/pdm
1. Install deps: `pdm install`
1. Activate the environment:
    * Linux: `eval $(pdm venv activate)`
    * Windows (PowerShell): `iex $(pdm venv activate)`
1. Run: `tnok --help` or `tnokd --help`
1. Build: `pdm build`
1. Check: `pdm quality`
1. Package: `pdm pyinstaller`
1. sbom is generated with: `pdm sbom`
1. `COPYRIGHT.md` is generated with: `pdm list --markdown > COPYRIGHT.md`

## Docker Scripts (Linux dev)

In a Linux or WSL development environment, there are also docker scripts that can be used to build, lint, and test tnok/tnokd.

1. Build: `./scripts/docker_build.sh`
1. Quality: `./scripts/docker_precommit.sh`
1. Test: `./scripts/docker_test.sh`

## Development Environment for Legacy Windows

_We support windows 7, all the way back to service pack 1._

1. Download and install Python 3.7 (3.7.0 works. Newer 3.7.X versions might also work but were not tested).
    * Python 3.7 is needed to support SQLAlchemy 2.x
    * **NOTE:** don't upgrade pip. Just use the version installed with Python
1. Download and install Legacy Wireshark version 2.2.1 and make sure to select to install WinPcap during Wireshark installation.
    * _Tip: Legacy versions of Wireshark for Windows can be found here: https://2.na.dl.wireshark.org/win64/all-versions/_
    * **npcap does not work.** Must be WinPcap.
1. Download a `.zip` of the repository and extract it or clone the repository with git.
1. Open an **admin** PowerShell window and change to the root of the extracted repository.
1. Install the requirements: `pip install -r requirements/requirements-legacy.txt`
1. Change to the `src` directory: `cd src` and run: `python -m tnok --help` or `python -m tnokd --help` for the client/service respectively.

## Troubleshooting

### The pdm venv activate command can't activate a non-venv Python

This might happen after running docker scripts. You can activate the project venv specifically with:

```shell
# Windows
iex $(pdm venv activate in-project)
# Linux
eval $(pdm venv activate in-project)
```
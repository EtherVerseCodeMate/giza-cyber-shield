#!/bin/bash

# Must be run from root of repository

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
LOGGING_SCRIPT="${SCRIPT_DIR}/logging.sh"

# Source the logging script for logging helpers
# shellcheck source=scripts/logging.sh
source "${LOGGING_SCRIPT}"

if [[ -f /.dockerenv && ! ${CI} ]]; then
    # Running inside docker, we can't use the .venv virtual environment b/c paths
    # will be wrong. Need to create a new one to use for docker
    log "Running in docker. Create .docker-venv"
    pdm venv create -n .docker-venv
    pdm use --venv .docker-venv
fi

# Build the package and output the SBOM
set -e
pdm install
output=$(pdm build)
src_dist_fname=$(echo "${output}" | grep -oE "/.*\.tar.gz")
src_dist_fname=$(basename "${src_dist_fname}")
pdm sbom > "./dist/${src_dist_fname}.json"
pdm pyinstaller
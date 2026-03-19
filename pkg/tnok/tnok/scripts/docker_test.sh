#!/bin/bash

# Must be run from root of repository

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
LOGGING_SCRIPT="${SCRIPT_DIR}/logging.sh"

# Source the logging script for logging helpers
# shellcheck source=scripts/logging.sh
source "${LOGGING_SCRIPT}"

if [[ ${CI} ]]; then
    log "Running in CI. Auth with container registry"
    if ! echo "${CI_JOB_TOKEN}" | docker login "${CI_REGISTRY}" -u "${CI_REGISTRY_USER}" --password-stdin; then
        log_error "Failed to authenticate with container registry"
        exit 1
    fi
fi

if ! docker compose -f "$(pwd)/docker/compose.yml" up -d; then
    log_error "Failed to compose docker network"
    exit 1
fi

rc=0
if ! "${SCRIPT_DIR}"/automated_tests/automated_tests.sh; then
    log_error "Automated tests failed"
    rc=1
fi

docker compose -f "$(pwd)/docker/compose.yml" down
exit $rc


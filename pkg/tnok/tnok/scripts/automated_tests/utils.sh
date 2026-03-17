#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
LOGGING_SCRIPT="${SCRIPT_DIR}/../logging.sh"

# Source the logging script for logging helpers
# shellcheck source=scripts/logging.sh
source "${LOGGING_SCRIPT}"

in_client_container() {
    docker exec tnok-client-1 "$@"
    return $?
}

in_server_container() {
    docker exec tnok-server-1 "$@"
    return $?
}

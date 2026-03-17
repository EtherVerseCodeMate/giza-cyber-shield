#!/bin/bash

# Simple script to test knocking on a single host using

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
UTILS_SCRIPT="${SCRIPT_DIR}/utils.sh"

# Source the utils script for functions
# shellcheck source=scripts/automated_tests/utils.sh
source "${UTILS_SCRIPT}"

if [[ $# -ne 2 ]]; then
    log_error "Usage: $0 <target_ip> <target_port>"
    exit 1
fi

target_ip=$1
target_port=$2

# Make sure it's closed initially
if ncat -w 1 -z "${target_ip}" "${target_port}"; then
    log_error "Expected port to be closed pre-knock."
    exit 1
fi

# Get the secret key
secret_key=$(in_server_container /source/tmp/tnokd --config "/source/tmp/tnokd.conf" --db "/source/tmp/db.sqlite" code | grep "Secret key:" | cut -d ':' -f 2)
log_success "Got secret key: ${secret_key}"

log "Starting client tcpdump..."
in_client_container tcpdump -i any -w /source/tmp/client-out.pcap &
tcpdump_client_pid=$!

count=0
success=false
while [ "${count}" -lt 3 ]; do
    log "Attempt ${count+1}/3"

    log "Getting code..."
    code=$(in_server_container python -c "import pyotp;x=\"${secret_key}\".strip();print(pyotp.TOTP(x).now())")
    log_success "Code: ${code}"

    if ! in_server_container /source/tmp/tnokd --config "/source/tmp/tnokd.conf" --db "/source/tmp/db.sqlite" validate --code "${code}"; then
        log_error "Invalid code."
        ((count++))
        sleep 5
        continue
    fi

    log "Knocking..."
    if ! in_client_container /source/tmp/tnok --debug --log "/source/tmp/tnok.log" --target "${target_ip}" --desired-port "${target_port}" --code "${code}"; then
        log_error "Failed. Port not opened by knock."
        ((count++))
        sleep 5
        continue
    fi

    success=true
    break
done

kill -SIGINT "${tcpdump_client_pid}" 2> /dev/null

if [[ "${success}" = true ]]; then
    log_success "Port opened by knock"
    exit 0
fi

log_error "Failed to open port with knock"
exit 1

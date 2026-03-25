#!/bin/bash

# Must be run from root of git repo

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
UTILS_SCRIPT="${SCRIPT_DIR}/utils.sh"

# Source the utils script for functions
# shellcheck source=scripts/automated_tests/utils.sh
source "${UTILS_SCRIPT}"

rm -rf ./tmp
mkdir -p ./tmp

pdm install
eval "$(pdm venv activate)"

# Build to temp directory
pyinstaller \
    --clean \
    -y \
    --distpath ./tmp \
    --onefile \
    --name tnok \
    ./src/tnok/__main__.py
pyinstaller \
    --clean \
    -y \
    --distpath ./tmp \
    --onefile \
    --name tnokd \
    --collect-data cincoconfig \
    ./src/tnokd/__main__.py

log "Adding port 12345..."
in_server_container /source/tmp/tnokd \
    --config "/source/tmp/tnokd.conf" \
    --db "/source/tmp/db.sqlite" \
    add-port \
    --number 12345 \
    --protocol tcp

log "Setting interface..."
in_server_container /source/tmp/tnokd \
    --config "/source/tmp/tnokd.conf" \
    --db "/source/tmp/db.sqlite" \
    set-interface \
    -i eth0

log "Starting TCP dump..."
in_server_container tcpdump -i any -w /source/tmp/server-out.pcap &
tcpdump_pid=$!

# Start the server in the server container
log "Starting tnokd..."
in_server_container /source/tmp/tnokd \
    --config "/source/tmp/tnokd.conf" \
    --db "/source/tmp/db.sqlite" \
    --log "/source/tmp/tnokd.log" \
    --debug \
    --trace \
    start &
tnokd_pid=$!
sleep 5
log_success "Server started. ${tnokd_pid}"

# Start listening on the port
in_server_container nc -lp 12345 &
nc_pid=$!

# Run the client knock test
rc=0
log "Running client knock test against 192.168.123.2:12345"
if ! "${SCRIPT_DIR}/tnok_client.sh" 192.168.123.2 12345; then
    log_error "Failed!"
    rc=1
else
    log_success "GREAT JORB!"
fi

kill -SIGINT "${nc_pid}" 2> /dev/null
kill -SIGINT "${tnokd_pid}" 2> /dev/null
kill -SIGINT "${tcpdump_pid}" 2> /dev/null

log "Done."
exit ${rc}

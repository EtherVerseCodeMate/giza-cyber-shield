#!/bin/bash

# Must be run from root of repository

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
LOGGING_SCRIPT="${SCRIPT_DIR}/logging.sh"

# Source the logging script for logging helpers
# shellcheck source=scripts/logging.sh
source "${LOGGING_SCRIPT}"

# For semgrep: sudo python3 -m pip install semgrep
run_semgrep() {
    log "semgrep..."
    rm -f semgrep.log

    SEMGREP_SEND_METRICS=off semgrep \
        --config=/opt/semgrep/default-rules/ \
        --config=/opt/semgrep/trailofbits-rules/ \
        --metrics=off \
        -o semgrep.log \
        ./src

    # Checks if the file is empty or not
    if [[ -s semgrep.log ]]; then
        # File is not empty. semgrep had findings...
        cat semgrep.log
        log_error "semgrep failed."
        exit 1
    fi

    rm -f semgrep.log
    log_success "Done."
}

# For Python linting: curl -sSL https://pdm-project.org/install-pdm.py | python3 -
run_python_linting() {
    log "pdm..."

    if [[ -f /.dockerenv && ! ${CI} ]]; then
        # Running inside docker, we can't use the .venv virtual environment b/c paths
        # will be wrong. Need to create a new one to use for docker
        log "Running in docker. Create .docker-venv"
        pdm venv create -n .docker-venv
        pdm use --venv .docker-venv
        pdm install
    fi

    if ! pdm quality; then
        log_error "pdm failed."
        exit 1
    fi
    log_success "Done."
}


# For ShellCheck: sudo apt install shellcheck
run_shellcheck() {
    log "ShellCheck scripts..."
    if ! find . -iname "*.sh" -print0 | xargs -0 shellcheck; then
        log_error "ShellCheck failed."
        exit 1
    fi

    log_success "Done."
}

# For osv-scanner: wget https://github.com/google/osv-scanner/releases/download/v1.7.4/osv-scanner_linux_amd64 -O osv-scanner && chmod +x ./osv-scanner
run_osv_scanner() {
    log "OSV Scanner..."
    if ! osv-scanner -r .; then
        log_error "OSV Scanner failed."
        exit 1
    fi
    log_success "Done."
}

# For cspell: sudo npm install -g cspell
run_cspell() {
    log "cspell..."
    if ! cspell -u '**/*.py' '**/*.md' '**/*.sh' '**/*.yml' '**/*.yaml'; then
        log_error "cspell failed."
        exit 1
    fi
    log_success "Done."
}

run_python_linting
run_shellcheck
run_osv_scanner
run_cspell
run_semgrep

exit 0
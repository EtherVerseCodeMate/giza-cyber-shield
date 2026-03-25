#!/bin/bash

# Logging functions for automated tests

RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'
COLOR_SUPPORT=$(tput colors 2> /dev/null)

echoerr() {
    echo "$@" 1>&2
}

log() {
    local msg=$1
    local lvl=$2
    local status_icon=""
    local color=""

    if [[ -z ${lvl} ]]; then
        lvl="INFO"
    fi

    if [[ ${lvl} == "INFO" ]]; then
        status_icon="+"
        color=${CYAN}
    elif [[ ${lvl} == "DEBUG" ]]; then
        status_icon="$"
        color=${BLUE}
    elif [[ ${lvl} == "ERROR" ]]; then
        status_icon="-"
        color=${RED}
    elif [[ ${lvl} == "WARNING" ]]; then
        status_icon="%"
        color=${YELLOW}
    elif [[ ${lvl} == "GREAT SUCCESS" ]]; then
        if [[ ${COLOR_SUPPORT} -ne -1 ]]; then
            status_icon="👍"
        else
            status_icon=":)"
        fi
        color=${GREEN}
    fi

    if [[ ${COLOR_SUPPORT} -ne -1 ]]; then
        if [[ ${lvl} == "ERROR" ]]; then
            echoerr -e "${color}[${status_icon}] $msg${NC}"
        else
            echo -e "${color}[${status_icon}] $msg${NC}"
        fi
    else
        if [[ ${lvl} == "ERROR" ]]; then
            echoerr "[${status_icon}] $msg"
        else
            echo "[${status_icon}] $msg"
        fi
    fi
}

log_success() {
    local msg=$1
    log "${msg}" "GREAT SUCCESS"
}

log_error() {
    local msg=$1
    log "${msg}" "ERROR"
}

log_debug() {
    local msg=$1

    if [[ ${SQUIRREL_OTA_VERBOSE} == true ]]; then
        log "${msg}" "DEBUG"
    fi
}

log_warning() {
    local msg=$1
    log "${msg}" "WARNING"
}

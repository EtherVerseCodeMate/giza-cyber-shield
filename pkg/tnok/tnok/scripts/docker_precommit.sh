#!/bin/bash

# Must be run from root of repository

CMD=("./scripts/precommit.sh" "${@}")

uid=$(id -u "${USER}")
gid=$(id -g "${USER}")

docker run -it \
    -u "${uid}:${gid}" \
    --rm \
    --volume "$(pwd)":/source \
    --workdir "/source" \
    "registry.gitlab.com/ainfosec-official/tnok/tester:latest" "${CMD[@]}"

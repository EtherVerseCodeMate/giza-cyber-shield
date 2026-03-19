#!/bin/bash

# Expects to be run from the docker directory

if ! docker build . -t registry.gitlab.com/ainfosec-official/tnok/tester:latest; then
    echo "Docker build failed for tester"
    exit 1
fi

pushd builder || exit 1
if ! docker build . -t registry.gitlab.com/ainfosec-official/tnok/builder:latest; then
    echo "Docker build failed for builder"
    exit 1
fi
popd || exit 1

if [[ $1 == "push" ]]; then
    if ! docker push registry.gitlab.com/ainfosec-official/tnok/tester:latest; then
        echo "Failed to push tester"
        exit 1
    fi
    if ! docker push registry.gitlab.com/ainfosec-official/tnok/builder:latest; then
        echo "Failed to push builder"
        exit 1
    fi
fi

exit 0
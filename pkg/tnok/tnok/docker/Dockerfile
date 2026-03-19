FROM ubuntu:24.04

USER root

RUN apt-get update && \
    DEBIAN_FRONTEND="noninteractive" apt-get install -y \
        curl \
        wget \
        python3 \
        python3-venv \
        python3-pip \
        shellcheck \
        iproute2 \
        net-tools \
        iptables \
        upx \
        npm \
        openssh-server \
        python-is-python3 \
        binutils \
        ncat \
        tcpdump \
        git \
    && npm install -g cspell \
    && python3 -m pip install --break-system-packages \
        semgrep \
        pyinstaller \
        pyotp

# Semgrep rules and things
WORKDIR /opt/semgrep
RUN git clone https://github.com/returntocorp/semgrep-rules.git default-rules \
    && rm -rf /opt/semgrep/default-rules/stats \
    && rm -f /opt/semgrep/default-rules/.pre-commit-config.yaml \
    && rm -rf /opt/semgrep/default-rules/.github \
    && git clone https://github.com/trailofbits/semgrep-rules.git trailofbits-rules \
    && rm -rf /opt/semgrep/trailofbits-rules/.github

# osv-scanner
WORKDIR /usr/local/bin
RUN wget https://github.com/google/osv-scanner/releases/download/v1.7.4/osv-scanner_linux_amd64 -O osv-scanner
RUN chmod +x ./osv-scanner

# Install PDM and make sure it's on the path
WORKDIR /home/ubuntu
USER ubuntu
RUN curl -sSL https://pdm-project.org/install-pdm.py | python3 -

SHELL ["/bin/bash", "-c"]
ENV PATH="${PATH}:/home/ubuntu/.local/bin"

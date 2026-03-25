FROM ubuntu:18.04

USER root

RUN apt-get update && \
    DEBIAN_FRONTEND="noninteractive" apt-get install -y \
        make \
        build-essential \
        libssl-dev \
        zlib1g-dev \
        libbz2-dev \
        libreadline-dev \
        libsqlite3-dev \
        wget \
        curl \
        llvm \
        libncurses5-dev \
        libncursesw5-dev \
        xz-utils \
        tk-dev \
        liblzma-dev \
        tk-dev \
        libgdbm-dev \
        libnss3-dev \
        libffi-dev

# Why? This is so we get a Python 3.12 that's been built with a fairly old libc on a EoL Ubuntu (18.04 in this case)
# which gives us a better guarentee that the binary we generate with pyinstaller will run since libc is backwards compatible
WORKDIR /tmp
RUN wget https://www.python.org/ftp/python/3.12.10/Python-3.12.10.tgz && \
    tar xzf Python-3.12.10.tgz && \
    cd Python-3.12.10 && \
    ./configure \
        --prefix=/opt/python/3.12.10/ \
        --enable-optimizations \
        --with-lto \
        --with-computed-gotos \
        --enable-shared \
        --enable-loadable-sqlite-extensions \
        --with-openssl=/usr && \
    make -j4 && \
    make altinstall && \
    cd /tmp && \
    rm /tmp/Python-3.12.10.tgz

RUN ln -s /opt/python/3.12.10/bin/python3.12 /usr/bin/python && \
    ln -s /opt/python/3.12.10/bin/python3.12 /usr/bin/python3 && \
    ln -s /opt/python/3.12.10/bin/python3.12 /usr/bin/python3.12 && \
    ln -s /opt/python/3.12.10/bin/pip3.12 /usr/bin/pip && \
    ln -s /opt/python/3.12.10/bin/pip3.12 /usr/bin/pip3 && \
    ln -s /opt/python/3.12.10/bin/pip3.12 /usr/bin/pip3.12 && \
    ln -s /opt/python/3.12.10/lib/libpython3.12.so.1.0 /usr/lib/x86_64-linux-gnu/libpython3.12.so.1.0 && \
    ln -s /opt/python/3.12.10/lib/libpython3.so /usr/lib/x86_64-linux-gnu/libpython3.so && \
    ln -s /opt/python/3.12.10/lib/libpython3.12.so.1.0 /usr/lib/x86_64-linux-gnu/libpython3.12.so && \
    ln -s /opt/python/3.12.10/include/python3.12 /usr/include/x86_64-linux-gnu/python3.12 && \
    python3.12 -m pip install --upgrade pip setuptools wheel

# Install PDM and make sure it's on the path
RUN useradd -d /home/ubuntu -m -s /bin/bash ubuntu
WORKDIR /home/ubuntu
USER ubuntu
RUN curl -sSL https://pdm-project.org/install-pdm.py | python3.12 -

SHELL ["/bin/bash", "-c"]
ENV PATH="${PATH}:/home/ubuntu/.local/bin"
FROM mcr.microsoft.com/devcontainers/base:debian AS base

# By default /workspaces is owned by `root`.
# When the Dev Container extension mounts the source directory, it changes the mounted file owner to `vscode`.
# A directory is created under /workspaces which is owned by `vscode` and acts as a scratch pad to store
# miscellaneous ephemeral files.
RUN <<EOF
mkdir -p /workspaces/dev /workspaces/build
chown vscode:vscode /workspaces/dev /workspaces/build
EOF

# curl/unzip: Bun install script; ca-certificates: HTTPS.
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl unzip
apt-get upgrade -y
rm -rf /var/lib/apt/lists/*
EOF

# Bun (pin matches root package.json "packageManager"). Installed for the default dev user.
ENV BUN_INSTALL=/home/vscode/.bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
USER vscode
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.13"

# Install Python and create a reusable virtual environment for the `vscode` user.
USER root
COPY requirements.txt /tmp/requirements.txt
RUN <<'EOF'
apt-get update
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip \
  build-essential libssl-dev libffi-dev \
  && rm -rf /var/lib/apt/lists/*
EOF

# Create a virtualenv in the vscode home and ensure ownership
RUN python3 -m venv /home/vscode/.venv \
  && /home/vscode/.venv/bin/python -m pip install --upgrade pip setuptools wheel \
  && if [ -s /tmp/requirements.txt ]; then /home/vscode/.venv/bin/python -m pip install --no-cache-dir -r /tmp/requirements.txt; fi \
  && chown -R vscode:vscode /home/vscode/.venv

# Expose the venv on PATH and set VIRTUAL_ENV for convenience
ENV VIRTUAL_ENV=/home/vscode/.venv
ENV PATH="$VIRTUAL_ENV/bin:${PATH}"

USER vscode

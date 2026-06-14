FROM mcr.microsoft.com/devcontainers/base:debian AS base

# By default /workspaces is owned by `root`.
# When the Dev Container extension mounts the source directory, it changes the mounted file owner to `vscode`.
# A directory is created under /workspaces which is owned by `vscode` and acts as a scratch pad to store
# miscellaneous ephemeral files.
RUN <<EOF
mkdir -p /workspaces/dev /workspaces/build
chown vscode:vscode /workspaces/dev /workspaces/build
EOF

# curl/unzip: Bun install script and notion-importer zip exports; ca-certificates: HTTPS.
# python3: optional one-off temporary scripts (see AGENTS.md).
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl unzip python3
apt-get upgrade -y
rm -rf /var/lib/apt/lists/*
EOF

# Bun (pin matches root package.json "packageManager"). System-wide so CI can run as bind-mount UID.
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
USER root
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.13"

# Workspace dependencies (installed at image build; devcontainer syncs into bind-mounted workspace).
USER root
WORKDIR /opt/marloth-story
COPY package.json bun.lock bunfig.toml ./
COPY packages packages
RUN chown -R vscode:vscode /opt/marloth-story
USER vscode
RUN bun install

WORKDIR /workspaces/marloth-story
# Bind-mounted workspace + node_modules volume are empty at first start; sync deps then run dev servers.
CMD ["/bin/bash", "-c", "cd /workspaces/marloth-story && bun install --frozen-lockfile && exec bun run editor:dev"]

FROM mcr.microsoft.com/devcontainers/base:debian AS base

# By default /workspaces is owned by `root`.
# When the Dev Container extension mounts the source directory, it changes the mounted file owner to `vscode`.
# A directory is created under /workspaces which is owned by `vscode` and acts as a scratch pad to store
# miscellaneous ephemeral files.
RUN <<EOF
mkdir -p /workspaces/dev /workspaces/build
chown vscode:vscode /workspaces/dev /workspaces/build
EOF

# Update packages; python3 for scripts/godot_remote.py; curl for rustup / smoke tests;
# build-essential + pkg-config + libssl-dev for native Rust / -sys crates
RUN <<EOF
apt-get update
apt-get upgrade -y
rm -rf /var/lib/apt/lists/*
EOF

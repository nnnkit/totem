FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI (as root, before switching user)
RUN npm install -g @anthropic-ai/claude-code

# Create a non-root user and switch to it
RUN useradd -m -s /bin/bash agent
USER agent

# Add to PATH
ENV PATH="/home/agent/.npm-global/bin:/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

ENTRYPOINT ["/bin/bash"]

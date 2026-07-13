# syntax=docker/dockerfile:1
# ATLAS API image. Build context is the REPO ROOT so workspace packages
# (@atlas/ai-core, @atlas/shared) are available. The API runs its TypeScript
# source directly via tsx, matching the dev/prod parity of the monorepo.
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Install dependencies (leverages layer caching on manifests).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --prod=false

ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@atlas/api", "start"]

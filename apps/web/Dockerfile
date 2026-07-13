# syntax=docker/dockerfile:1
# ATLAS web image. Build context is the REPO ROOT. NEXT_PUBLIC_* values are
# inlined at build time, so the API/socket URLs are provided as build args.
FROM node:20-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --prod=false

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN pnpm --filter @atlas/web build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@atlas/web", "start"]

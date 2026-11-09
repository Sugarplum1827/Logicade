FROM node:22-bookworm-slim AS node

FROM python:3.11-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /opt/logicade
ENV PYTHONUNBUFFERED=1
COPY deployment/school-server/requirements-server.txt /tmp/requirements-server.txt
RUN pip install --no-cache-dir -r /tmp/requirements-server.txt && useradd -m -u 10001 logicade
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/* && node --version
COPY server ./server
COPY data ./data
COPY games ./games
COPY vendor ./vendor
COPY admin ./admin
COPY supabase/migrations ./supabase/migrations
COPY deployment/school-server ./deployment/school-server
COPY client/dist ./client/dist
RUN mkdir -p .state data/runtime data/game_build_cache && chown -R logicade:logicade /opt/logicade && chmod -R u+rwX data games .state
USER logicade
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]

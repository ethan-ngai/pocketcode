FROM docker.io/cloudflare/sandbox:0.9.0-python

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

# HelpDesk Call Log - Docker Image

This Docker setup serves your `HelpDeskCallLog.html` via Nginx.

## Files
- `Dockerfile`: Builds an nginx:alpine image and copies the HTML as `index.html`.
- `nginx.conf`: Minimal Nginx config to serve the page.
- `docker-compose.yml`: Convenience compose file to run on port 8080.

## Build
From this folder:

```sh
# Build the image
docker build -t helpdesk-call-log:latest .
```

## Run
```sh
# Run with docker
docker run -d --name helpdesk-call-log -p 8080:80 helpdesk-call-log:latest

# Or with docker-compose
docker compose up -d
```

## Access
Open http://localhost:8080 (or replace `localhost` with the server's IP) on your company network.

## Updating the HTML
If you edit `HelpDeskCallLog.html` at the workspace root, rebuild the image and restart the container.

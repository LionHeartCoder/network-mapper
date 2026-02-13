# Use a small, secure web server image
FROM nginx:alpine

# Copy our nginx site config (overrides default)
COPY docker/helpdesk-call-log/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Help Desk HTML into the web root as index.html
COPY HelpDeskCallLog.html /usr/share/nginx/html/index.html

# Expose HTTP
EXPOSE 80

# No CMD needed; base image starts nginx by default

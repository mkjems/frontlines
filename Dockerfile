FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --chown=101:101 site/ /usr/share/nginx/html/

EXPOSE 8080

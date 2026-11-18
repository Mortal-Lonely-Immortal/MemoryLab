FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY teach.js /usr/share/nginx/html/teach.js
COPY teach.css /usr/share/nginx/html/teach.css
COPY archive3d.js /usr/share/nginx/html/archive3d.js
COPY archive3d.css /usr/share/nginx/html/archive3d.css
COPY vendor /usr/share/nginx/html/vendor
COPY assets /usr/share/nginx/html/assets

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/

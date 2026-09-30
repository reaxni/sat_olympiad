FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_DESMOS_API_KEY
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DESMOS_API_KEY=${VITE_DESMOS_API_KEY}
RUN test -n "$VITE_API_BASE_URL" || (echo "Set VITE_API_BASE_URL to your public backend URL in Railway." >&2; exit 1)
RUN npm run build

FROM nginx:stable-alpine
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

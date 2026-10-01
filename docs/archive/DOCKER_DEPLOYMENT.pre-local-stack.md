# Docker Deployment Guide

This guide explains how to run the application in Docker containers, both for development and production environments.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher

## Quick Start

### Production Deployment

1. **Create environment file:**
```bash
cp .env.example .env
```

2. **Configure your environment variables in `.env`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. **Build and run:**
```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

4. **Access the application:**
   - Open your browser to `http://localhost:3000`

### Development Mode with Hot Reload

For local development with hot reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build
```

Access the development server at `http://localhost:5173`

## Docker Architecture

### Production Build (Dockerfile)

The production Dockerfile uses a multi-stage build:

1. **Builder Stage**: Compiles the application
   - Installs dependencies
   - Builds optimized production bundle
   - Tree-shakes unused code

2. **Runner Stage**: Serves the static files
   - Lightweight Node.js Alpine image
   - Uses `serve` package for static hosting
   - Includes health checks

### Development Build (Dockerfile.dev)

- Single-stage build for faster iteration
- Hot module replacement enabled
- Source code mounted as volume
- Port 5173 exposed for Vite dev server

## Container Management

### Basic Commands

```bash
# Build image
docker-compose build

# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f app

# Restart container
docker-compose restart app

# Execute commands in container
docker-compose exec app sh
```

### Health Checks

The production container includes health checks:
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

Check health status:
```bash
docker-compose ps
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `VITE_API_BASE_URL` | API base URL | `/api` |

## Supabase Integration in Docker

### Authentication Flow

The application connects to Supabase Cloud (external service):

```
┌─────────────────┐      ┌──────────────────┐
│  Docker         │      │   Supabase       │
│  Container      │─────▶│   Cloud          │
│  (Frontend)     │      │   (Backend)      │
└─────────────────┘      └──────────────────┘
```

### Network Configuration

- The container uses bridge networking by default
- Supabase URLs must be accessible from within the container
- No special network configuration needed for cloud-hosted Supabase

### CORS Configuration

The Supabase project must allow requests from your Docker host:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Docker host URL to allowed origins
3. For local development: `http://localhost:3000` and `http://localhost:5173`

## Production Deployment Options

### Option 1: Docker Compose (Recommended for single-server)

```bash
# Deploy to production server
docker-compose up -d

# Scale if needed (requires load balancer)
docker-compose up -d --scale app=3
```

### Option 2: Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml myapp

# Check services
docker service ls

# Scale service
docker service scale myapp_app=3
```

### Option 3: Kubernetes

See `kubernetes/` directory for deployment manifests (to be created).

## Optimization Tips

### Build Optimization

1. **Layer Caching**: Dependencies are copied before source code
2. **Multi-stage Build**: Only production artifacts in final image
3. **Alpine Base**: Minimal image size (~50MB)

### Runtime Optimization

1. **Serve Package**: Optimized static file serving
2. **Health Checks**: Automatic container restart on failure
3. **Resource Limits**: Set in docker-compose.yml if needed

Example resource limits:
```yaml
services:
  app:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check if port is in use
lsof -i :3000

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Can't connect to Supabase

1. Verify environment variables:
```bash
docker-compose exec app env | grep SUPABASE
```

2. Check network connectivity:
```bash
docker-compose exec app wget -O- https://wzfdfrruaxqldhsfuxpe.supabase.co
```

3. Verify CORS settings in Supabase Dashboard

### Build fails

```bash
# Clear Docker cache
docker builder prune

# Rebuild without cache
docker-compose build --no-cache
```

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Use secrets management** in production (Docker Secrets, Vault)
3. **Scan images** for vulnerabilities:
```bash
docker scan your-image-name
```
4. **Run as non-root** user (add to Dockerfile if needed)
5. **Keep base images updated**

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t myapp:latest .
      
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push myapp:latest
```

## Monitoring

### View Logs

```bash
# All logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 app

# Follow new logs only
docker-compose logs -f --tail=0 app
```

### Container Stats

```bash
# Real-time resource usage
docker stats

# Specific container
docker stats myapp_app_1
```

## Backup and Restore

Since the application is stateless (data in Supabase), backup focuses on:

1. **Environment Configuration**: Backup `.env` file securely
2. **Supabase Data**: Use Supabase Dashboard for database backups
3. **User Uploads**: If using Supabase Storage, configure automatic backups

## Support

For issues:
1. Check application logs: `docker-compose logs`
2. Verify Supabase connectivity
3. Review environment variables
4. Check Docker networking: `docker network inspect`

## Next Steps

- [ ] Configure reverse proxy (Nginx/Traefik)
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up automated backups
- [ ] Implement CI/CD pipeline

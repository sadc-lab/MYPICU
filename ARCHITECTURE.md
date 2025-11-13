# Application Architecture

## Overview

This is a modern healthcare application (MyPICU) built with React, TypeScript, and Tailwind CSS, with Supabase providing backend services. The application is fully containerized with Docker for easy deployment.

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **shadcn/ui** - Component library
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Lucide React** - Icons

### Backend (Supabase)
- **PostgreSQL** - Database
- **Authentication** - User management
- **Row Level Security** - Data access control
- **Realtime** - Live data updates (optional)
- **Storage** - File uploads (if needed)

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Production web server (optional)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container (Frontend)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Application                                      │ │
│  │  ├── Pages (Dashboard, Optistats, etc.)               │ │
│  │  ├── Components (PatientTable, Header, etc.)          │ │
│  │  ├── Services (API Layer)                             │ │
│  │  ├── Hooks (React Query, useAuth)                     │ │
│  │  └── Types (TypeScript interfaces)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Supabase Cloud (External Service)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                   │ │
│  │  ├── Patients Table                                    │ │
│  │  ├── Users/Profiles Table                             │ │
│  │  └── Other Tables                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Authentication Service                                │ │
│  │  ├── Email/Password                                    │ │
│  │  ├── OAuth (Google, etc.)                             │ │
│  │  └── Session Management                                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Edge Functions (Optional)                             │ │
│  │  └── Custom Business Logic                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
.
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn components
│   │   ├── Header.tsx      # App header
│   │   ├── PatientTable.tsx
│   │   └── ...
│   ├── pages/              # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Optistats.tsx
│   │   ├── auth/           # Authentication pages
│   │   └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.tsx     # Authentication hook
│   │   ├── usePatients.ts  # Data fetching hooks
│   │   └── ...
│   ├── services/           # API and business logic
│   │   ├── api.config.ts   # HTTP client config
│   │   └── patient.service.ts
│   ├── types/              # TypeScript definitions
│   │   └── patient.types.ts
│   ├── utils/              # Utility functions
│   │   └── patientData.ts  # Static data (temp)
│   ├── integrations/       # External integrations
│   │   └── supabase/
│   │       └── client.ts   # Supabase client
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── public/                 # Static assets
├── supabase/              # Supabase config (if using)
│   ├── config.toml
│   └── functions/         # Edge functions
├── Dockerfile             # Production container
├── Dockerfile.dev         # Development container
├── Dockerfile.nginx       # Nginx-based container
├── docker-compose.yml     # Production orchestration
├── docker-compose.dev.yml # Development orchestration
├── nginx.conf             # Nginx configuration
└── ...
```

## Data Flow

### 1. User Authentication Flow

```
User Input → useAuth Hook → Supabase Auth API → Session Storage → Protected Routes
```

**Implementation:**
- `useAuth` hook manages auth state
- Session persisted in localStorage (automatic)
- `ProtectedRoute` component guards routes
- Automatic token refresh by Supabase client

### 2. Data Fetching Flow

```
Component → usePatients Hook → React Query → Service Layer → Supabase API → PostgreSQL
                                    ↓
                               Cache (5min)
```

**Benefits:**
- Automatic caching (5-minute stale time)
- Background refetching
- Optimistic updates
- Loading/error states
- Request deduplication

### 3. Patient Data Update Flow

```
User Action → useUpdatePatient → Service Layer → Supabase API → Database
                ↓
         Cache Invalidation
                ↓
        UI Auto-updates
```

## Docker Architecture

### Development Mode

```
Docker Container
├── Node.js 20 Alpine
├── Source Code (mounted volume)
├── Vite Dev Server (port 5173)
└── Hot Module Replacement ✓
```

**Benefits:**
- Instant code changes
- Full debugging support
- Consistent environment

### Production Mode

**Option 1: Node + Serve**
```
Multi-stage Build
├── Builder Stage (Node.js)
│   ├── Install dependencies
│   ├── Build optimized bundle
│   └── Tree-shake unused code
└── Runner Stage (Node.js Alpine)
    ├── Serve package
    ├── Static files (~50MB)
    └── Health checks
```

**Option 2: Nginx**
```
Multi-stage Build
├── Builder Stage (Node.js)
│   └── Build optimized bundle
└── Runner Stage (Nginx Alpine)
    ├── Nginx web server
    ├── Static files (~30MB)
    ├── Gzip compression
    └── Security headers
```

## Environment Configuration

### Local Development
- `.env.local` (gitignored)
- Hot reload enabled
- Source maps enabled
- Debug tools active

### Docker Development
- `.env` file mounted
- Volume mounting for live code changes
- Exposed ports: 5173

### Docker Production
- Environment variables from `.env` or Docker secrets
- Optimized bundle
- Production-ready settings
- Exposed ports: 3000 (serve) or 80 (nginx)

## Security Considerations

### Frontend
- ✅ No sensitive data in code
- ✅ Environment variables for config
- ✅ HTTPS in production (via reverse proxy)
- ✅ Content Security Policy headers
- ✅ XSS protection

### Backend (Supabase)
- ✅ Row Level Security (RLS) policies
- ✅ JWT token authentication
- ✅ Automatic token refresh
- ✅ Secure session storage
- ✅ Role-based access control (RBAC)

### Docker
- ✅ Multi-stage builds (smaller attack surface)
- ✅ Alpine Linux (minimal base image)
- ✅ Non-root user execution (can be added)
- ✅ Health checks
- ✅ Secrets management (Docker secrets or env vars)

## Deployment Strategies

### Single Server
```bash
# Using Docker Compose
docker-compose up -d
```

### Cloud Platforms

**AWS ECS**
- Use Dockerfile for task definition
- ECS handles orchestration
- ALB for load balancing

**Google Cloud Run**
```bash
gcloud run deploy --image gcr.io/project/app
```

**Azure Container Instances**
```bash
az container create --image app:latest
```

**Kubernetes**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mypicu-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: mypicu:latest
        ports:
        - containerPort: 3000
```

## Scaling Considerations

### Horizontal Scaling
- Frontend: Stateless, can scale infinitely
- Database: Handled by Supabase (managed service)
- Session: Stored client-side (JWT tokens)

### Performance Optimization
- React Query caching (reduces API calls)
- Code splitting (lazy loading)
- Image optimization
- Gzip compression
- CDN for static assets (if deployed)

## Monitoring and Logging

### Application Logs
```bash
# Docker logs
docker-compose logs -f app

# Specific container
docker logs container_id
```

### Supabase Logs
- Database queries via Dashboard
- Auth events
- Edge function logs
- Error tracking

### Health Checks
- Container health: `/health` endpoint
- Application health: React Query devtools
- Backend health: Supabase Dashboard

## Future Enhancements

### Backend
- [ ] Edge functions for complex business logic
- [ ] Real-time subscriptions for live updates
- [ ] File storage for medical documents
- [ ] Automated backups

### Frontend
- [ ] Progressive Web App (PWA)
- [ ] Offline support
- [ ] Push notifications
- [ ] Advanced analytics

### DevOps
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing
- [ ] Container registry
- [ ] Blue-green deployments
- [ ] Monitoring (Prometheus/Grafana)

## Support and Documentation

- **Docker Guide**: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
- **Backend Integration**: [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)
- **Supabase Docs**: https://supabase.com/docs
- **React Query Docs**: https://tanstack.com/query/latest

## Contributing

When making changes:
1. Update TypeScript types first
2. Modify service layer for data operations
3. Update React Query hooks if needed
4. Update components last
5. Test in Docker before committing
6. Update documentation

This architecture ensures:
- ✅ Separation of concerns
- ✅ Type safety
- ✅ Easy testing
- ✅ Scalability
- ✅ Maintainability
- ✅ Docker compatibility

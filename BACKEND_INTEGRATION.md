# Backend Integration Guide

This application is structured with a clean separation between the frontend UI and data layer, making it easy to integrate with a backend when ready.

> **Docker Deployment**: See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for containerization and deployment instructions.

## Current Architecture

### 📁 Directory Structure

```
src/
├── types/
│   └── patient.types.ts          # TypeScript interfaces for all data models
├── services/
│   ├── api.config.ts              # HTTP client configuration
│   └── patient.service.ts         # Patient data service layer
├── hooks/
│   └── usePatients.ts             # React Query hooks for data fetching
└── utils/
    └── patientData.ts             # Static data (temporary)
```

### 🔄 Data Flow

```
Components → React Query Hooks → Service Layer → API/Database
   ↓              ↓                    ↓              ↓
PatientTable   usePatients()    patientService   Static Data
                                                 (ready for API)
```

## How to Connect to a Backend

### Step 1: Update API Configuration

Edit `src/services/api.config.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://your-api-endpoint.com/api',  // Update this
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};
```

### Step 2: Update Service Methods

Replace the static data implementations in `src/services/patient.service.ts`:

**Before (static data):**
```typescript
async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
  await new Promise(resolve => setTimeout(resolve, 100));
  let patients = [...pedAPatients, ...pedBPatients];
  // ... filtering logic
  return { patients, total: patients.length };
}
```

**After (API integration):**
```typescript
async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
  return apiClient.get<PatientResponse>('/patients', params);
}
```

### Step 3: Add Authentication (if needed)

Update `src/services/api.config.ts` to include auth tokens:

```typescript
export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    ...API_CONFIG.HEADERS,
    Authorization: token ? `Bearer ${token}` : '',
  };
};
```

### Step 4: Enable Lovable Cloud (Recommended)

For the fastest backend setup:

1. Enable Lovable Cloud in your project
2. Use the built-in Supabase database for patient data
3. Authentication is already configured with `useAuth` hook
4. Update service methods to use Supabase client instead of fetch

**Example with Supabase:**
```typescript
import { supabase } from '@/integrations/supabase/client';

async getPatients(params?: PatientQueryParams): Promise<PatientResponse> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('pelodScore', { ascending: false });
    
  if (error) throw error;
  
  return {
    patients: data || [],
    total: data?.length || 0
  };
}
```

## Benefits of Current Architecture

✅ **Clean Separation**: UI components are decoupled from data fetching logic
✅ **Type Safety**: Full TypeScript support with centralized types
✅ **Caching**: React Query automatically caches and invalidates data
✅ **Loading States**: Built-in loading and error handling
✅ **Optimistic Updates**: Easy to implement with React Query mutations
✅ **Backend Agnostic**: Works with any REST API, GraphQL, or Supabase
✅ **Testing**: Service layer can be easily mocked for unit tests

## React Query Features Available

- **Automatic Refetching**: Data refreshes when window regains focus
- **Cache Management**: Intelligent caching with configurable stale times
- **Mutations**: `useUpdatePatient` hook ready for updates
- **Optimistic Updates**: Can update UI before server responds
- **Error Handling**: Centralized error handling with toast notifications

## Migration Checklist

- [ ] Set up backend API or enable Lovable Cloud
- [ ] Create database tables for patients
- [ ] Update `API_CONFIG.BASE_URL`
- [ ] Replace service methods with real API calls
- [ ] Add authentication headers if needed
- [ ] Test data fetching in development
- [ ] Update environment variables for production
- [ ] Remove static data imports from `patientData.ts`

## Need Help?

This architecture follows React best practices and is ready for production. When you're ready to connect to a backend, simply update the service layer methods and the rest of your application will work seamlessly.

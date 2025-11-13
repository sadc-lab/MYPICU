/**
 * API Configuration
 * 
 * This file contains the base configuration for API calls.
 * When connecting to a backend, update the BASE_URL to point to your API endpoint.
 */

export const API_CONFIG = {
  // TODO: Update this when backend is connected
  BASE_URL: process.env.NODE_ENV === 'production' 
    ? '/api'  // Production API endpoint
    : '/api', // Development API endpoint
  
  TIMEOUT: 30000, // 30 seconds
  
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

/**
 * HTTP client wrapper (ready for backend integration)
 * 
 * Usage example when backend is ready:
 * 
 * const response = await apiClient.get<PatientResponse>('/patients');
 * const patient = await apiClient.post<Patient>('/patients', newPatientData);
 */
export const apiClient = {
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: API_CONFIG.HEADERS,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },
};

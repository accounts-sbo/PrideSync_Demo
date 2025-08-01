// API utility functions for PrideSync

const getBackendUrl = () => {
  // In production, use the Railway backend URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pridesync-demo-production.up.railway.app';
  }
  
  // In development, use localhost
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
};

const getApiUrl = (endpoint: string) => {
  const backendUrl = getBackendUrl();
  return `${backendUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

export const api = {
  // Generic fetch wrapper with error handling
  async fetch(endpoint: string, options: RequestInit = {}) {
    const url = getApiUrl(endpoint);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  },

  // Voting API calls
  voting: {
    async getBoats() {
      return api.fetch('/api/voting/boats');
    },

    async vote(boatNumber: number, voteType: 'heart' | 'star', userSession: string) {
      return api.fetch('/api/voting/vote', {
        method: 'POST',
        body: JSON.stringify({
          boat_number: boatNumber,
          vote_type: voteType,
          user_session: userSession,
        }),
      });
    },

    async getUserVotes(userSession: string) {
      return api.fetch(`/api/voting/user/${userSession}`);
    },

    async getLeaderboard(limit = 10) {
      return api.fetch(`/api/voting/leaderboard?limit=${limit}`);
    },

    async submitIdea(idea: string, email: string, userSession: string) {
      return api.fetch('/api/voting/ideas', {
        method: 'POST',
        body: JSON.stringify({
          idea,
          email,
          user_session: userSession,
        }),
      });
    },
  },

  // Device management API calls
  devices: {
    async getMappings() {
      return api.fetch('/api/device-management/mappings');
    },

    async getBoats() {
      return api.fetch('/api/device-management/boats');
    },

    async createMapping(data: {
      boat_number: number;
      device_imei: string;
      device_serial?: string;
      mac_address?: string;
    }) {
      return api.fetch('/api/device-management/mappings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateMapping(id: number, data: any) {
      return api.fetch(`/api/device-management/mappings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async toggleMapping(id: number, isActive: boolean) {
      return api.fetch(`/api/device-management/mappings/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
    },
  },

  // Location/GPS API calls
  locations: {
    async getNearestBoat(lat: number, lon: number) {
      return api.fetch(`/api/locations/nearest?lat=${lat}&lon=${lon}`);
    },

    async getAllBoatLocations() {
      return api.fetch('/api/locations/all');
    },
  },

  // GPS utility functions
  gps: {
    async getCurrentPosition(): Promise<GeolocationPosition> {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      });
    },

    async watchPosition(callback: (position: GeolocationPosition) => void, errorCallback?: (error: GeolocationPositionError) => void): Promise<number> {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }

        const watchId = navigator.geolocation.watchPosition(
          callback,
          errorCallback || ((error) => console.error('GPS watch error:', error)),
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000
          }
        );

        resolve(watchId);
      });
    },

    clearWatch(watchId: number) {
      navigator.geolocation.clearWatch(watchId);
    },

    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    },

    formatDistance(distanceKm: number): string {
      if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
      }
      return `${distanceKm.toFixed(1)}km`;
    }
  },

  // Health check
  async health() {
    return api.fetch('/health');
  },

  // Get backend URL for external links
  getBackendUrl,
  getApiUrl,
};

export default api;

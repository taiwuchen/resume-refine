const defaultApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api';
  }

  return `http://${window.location.hostname}:8000/api`;
};

export const API_BASE = import.meta.env.VITE_API_BASE ?? defaultApiBase();

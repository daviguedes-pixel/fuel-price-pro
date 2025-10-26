import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function useApiAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get<{ user: User }>('/api/auth/check');
      setUser(response.user);
      setLoading(false);
    } catch (error) {
      setUser(null);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post<AuthResponse>(
        '/api/auth/signin',
        { email, password },
        { auth: false }
      );

      // Store access token
      localStorage.setItem('accessToken', response.accessToken);

      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await api.post('/api/auth/signout', {}, { auth: true });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}

"use client";

import { useState } from 'react';

/**
 * Temporary mock auth hook to resolve build errors.
 * In a production app, this would manage JWT tokens or session state.
 */
export const useAuth = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  return {
    token,
    user,
    isAuthenticated: !!token,
    login: async () => {},
    logout: async () => {},
  };
};

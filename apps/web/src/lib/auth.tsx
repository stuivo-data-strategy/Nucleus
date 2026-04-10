"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface NucleusUser {
  sub: string;
  employee_id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  org_unit: string;
  cost_centre: string;
  manager: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  title: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: NucleusUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  switchUser: (personId: string) => Promise<void>;
  availableUsers: PersonSummary[];
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NucleusUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<PersonSummary[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      let token = localStorage.getItem('nucleus_token');
      
      try {
          if (!token) {
              const res = await fetch('http://localhost:3001/api/v1/auth/bypass', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ person_id: 'person:sarah_chen' })
              });
              if (res.ok) {
                  const data = await res.json();
                  token = data.data.token;
                  localStorage.setItem('nucleus_token', token as string);
              }
          }

          if (token) {
            const res = await fetch('http://localhost:3001/api/v1/auth/me', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              setUser(data.data);
            } else {
               localStorage.removeItem('nucleus_token');
            }
          }

          const optRes = await fetch('http://localhost:3001/api/v1/auth/switch-options');
          if (optRes.ok) {
             const odata = await optRes.json();
             setAvailableUsers(odata.data);
          }
      } catch(e) {
          console.error("Auth init error", e);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const switchUser = async (personId: string) => {
    setIsLoading(true);
    try {
       const res = await fetch('http://localhost:3001/api/v1/auth/bypass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_id: personId })
       });
       if (res.ok) {
          const data = await res.json();
          localStorage.setItem('nucleus_token', data.data.token);
          window.location.reload(); 
       }
    } finally {
       setIsLoading(false);
    }
  };

  const login = async () => { };
  const logout = async () => {
     localStorage.removeItem('nucleus_token');
     setUser(null);
     window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      switchUser, availableUsers, login, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

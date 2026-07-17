import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (getToken()) {
        try {
          const { user } = await api.get('/auth/me');
          setUser(user);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function login(usuario, senha) {
    const data = await api.post('/auth/login', { usuario, senha });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register({ nome, usuario, senha, email }) {
    const data = await api.post('/auth/register', { nome, usuario, senha, email });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

const normalizeUser = (u) => {
  if (!u) return null;
  const userId = u._id || u.id;
  return {
    ...u,
    _id: userId,
    id: userId,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('jobbyhop_user');
      const token = localStorage.getItem('jobbyhop_token');
      if (token && storedUser) {
        return normalizeUser(JSON.parse(storedUser));
      }
    } catch (e) {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('jobbyhop_token');
    return Boolean(token);
  });

  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('jobbyhop_user');
      const token = localStorage.getItem('jobbyhop_token');

      if (token && storedUser) {
        try {
          const res = await API.get('/auth/me');
          if (res.success && res.user) {
            setUser(normalizeUser(res.user));
          } else {
            localStorage.removeItem('jobbyhop_token');
            localStorage.removeItem('jobbyhop_user');
            setUser(null);
          }
        } catch (err) {
          // If there's an error (e.g. 401/403 or network), we must NOT allow access.
          // The global API interceptor handles the 401 redirect.
          // Here we just ensure the user state is completely cleared.
          localStorage.removeItem('jobbyhop_token');
          localStorage.removeItem('jobbyhop_user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Periodic session validation (every 30 seconds)
  useEffect(() => {
    let intervalId;
    if (user) {
      intervalId = setInterval(async () => {
        try {
          await API.get('/auth/me');
        } catch (err) {
          // If 401, the global api interceptor handles the redirect.
          // This catch block prevents unhandled promise rejections.
        }
      }, 30000);
    }
    return () => clearInterval(intervalId);
  }, [user]);

  const login = async (email, password, expectedRole) => {
    try {
      // Try real backend API first
      const payload = { email, password };
      if (expectedRole) {
        payload.expectedRole = expectedRole;
      }
      const res = await API.post('/auth/login', payload);
      if (res && res.success) {
        if (res.requirePasswordChange) {
          return { success: true, requirePasswordChange: true, token: res.token, user: normalizeUser(res.user) };
        }
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : 'Invalid email or password');
    }
  };

  const forceChangePassword = async (newPassword, tempToken) => {
    try {
      const res = await API.post('/auth/force-change-password', { newPassword }, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      if (res && res.success) {
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : 'Failed to change password');
    }
  };

  const registerRecruiter = async (data) => {
    try {
      const res = await API.post('/auth/register/recruiter', data);
      if (res && res.success) {
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : 'Registration failed');
    }
  };

  const registerWorker = async (data) => {
    try {
      const res = await API.post('/auth/register/worker', data);
      if (res && res.success) {
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : 'Registration failed');
    }
  };

  const googleRegisterWorker = async (authData, formData) => {
    try {
      let payload;
      if (typeof authData === 'object' && authData.formData) {
        payload = authData;
      } else if (typeof authData === 'object') {
        payload = { ...authData, formData };
      } else {
        payload = { idToken: authData, registrationToken: authData, formData };
      }
      const res = await API.post('/auth/google/register/worker', payload);
      if (res && res.success) {
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
      throw new Error(res?.message || 'Google Worker registration failed');
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : err.message || 'Registration failed');
    }
  };

  const googleRegisterRecruiter = async (authData, formData) => {
    try {
      let payload;
      if (typeof authData === 'object' && authData.formData) {
        payload = authData;
      } else if (typeof authData === 'object') {
        payload = { ...authData, formData };
      } else {
        payload = { idToken: authData, registrationToken: authData, formData };
      }
      const res = await API.post('/auth/google/register/recruiter', payload);
      if (res && res.success) {
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
      throw new Error(res?.message || 'Google Recruiter registration failed');
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : err.message || 'Registration failed');
    }
  };

  const googleLogin = async (idToken, expectedRole) => {
    try {
      const payload = { idToken };
      if (expectedRole) payload.expectedRole = expectedRole;
      const res = await API.post('/auth/google/login', payload);
      if (res && res.success) {
        // If this is a new Google user without an account yet, return response directly
        // so the UI can prompt for Worker vs Recruiter role selection
        if (res.isNewUser) {
          return res;
        }
        const normUser = normalizeUser(res.user);
        localStorage.setItem('jobbyhop_token', res.token);
        localStorage.setItem('jobbyhop_user', JSON.stringify(normUser));
        setUser(normUser);
        return res;
      }
      throw new Error(res?.message || 'Google login failed');
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : err.message || 'Google login failed');
    }
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('jobbyhop_token');
    localStorage.removeItem('jobbyhop_user');
    setUser(null);
  };

  const updateUserProfile = (updatedProfile) => {
    setUser((prev) => {
      if (!prev) return null;
      const newU = { ...prev, profile: { ...prev.profile, ...updatedProfile } };
      localStorage.setItem('jobbyhop_user', JSON.stringify(newU));
      return newU;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        googleLogin,
        googleRegisterWorker,
        googleRegisterRecruiter,
        forceChangePassword,
        registerRecruiter,
        registerWorker,
        logout,
        updateUserProfile,
        isAdmin: user?.role === 'ADMIN',
        isRecruiter: user?.role === 'RECRUITER',
        isWorker: user?.role === 'WORKER',
        isOperations: user?.role === 'OPERATIONS',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;

import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import Cookie from 'js-cookie';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const user    = useAuthStore((s) => s.user);
  const token   = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const logout  = useAuthStore((s) => s.logout);
  const [restoring, setRestoring] = useState(false);

  const cookieToken = Cookie.get('token');
  const hasToken = !!(token || cookieToken);

  useEffect(() => {
    if (!hasToken) {
      navigate('/login');
      return;
    }
    // Token present but user missing (hard refresh cleared memory store)
    if (hasToken && !user) {
      setRestoring(true);
      api
        .get('/users/me')
        .then((res) => {
          const u = res.data;
          setUser({ id: u.id, username: u.username, role: u.role, email: u.email });
        })
        .catch(() => {
          logout();
          Cookie.remove('token');
          navigate('/login');
        })
        .finally(() => setRestoring(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  if (!hasToken) return null;

  if (restoring) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在恢复登录状态..." />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookie from 'js-cookie';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token) || Cookie.get('token');

  React.useEffect(() => {
    if (!user && !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  if (!user && !token) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

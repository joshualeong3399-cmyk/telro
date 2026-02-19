/**
 * Role-based access control middleware
 * Roles hierarchy: admin > operator > merchant > employee
 *
 * Usage:
 *   router.get('/admin-only', requireRole('admin'), handler)
 *   router.get('/ops-up',     requireRole('admin','operator'), handler)
 */

const ROLE_LEVEL = {
  admin: 4,
  operator: 3,
  merchant: 2,
  employee: 1,
};

/**
 * requireRole(...allowedRoles)
 * Returns middleware that allows a request if the authenticated user has
 * one of the specified roles (or a higher-level role).
 * By default, 'admin' always passes regardless of the allowed list.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user; // set by authMiddleware
    if (!user) {
      return res.status(401).json({ error: '未认证' });
    }
    // admin always wins
    if (user.role === 'admin') return next();

    if (allowedRoles.includes(user.role)) {
      return next();
    }
    return res.status(403).json({ error: '权限不足' });
  };
}

/**
 * requireMinLevel(minRole)
 * Allows the request if user's role level >= the given role's level.
 * e.g. requireMinLevel('merchant') allows merchant AND operator AND admin.
 */
export function requireMinLevel(minRole) {
  const minLevel = ROLE_LEVEL[minRole] ?? 0;
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: '未认证' });
    if ((ROLE_LEVEL[user.role] ?? 0) >= minLevel) return next();
    return res.status(403).json({ error: '权限不足' });
  };
}

export default requireRole;

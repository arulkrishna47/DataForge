const { createClient } = require('@supabase/supabase-js');
const prisma = require('../db');

// Supabase admin client (uses service role key to validate user tokens)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const protect = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // --- PRIMARY PATH: Supabase Bearer Token ---
  if (bearerToken) {
    try {
      const { data: { user: sbUser }, error } = await supabase.auth.getUser(bearerToken);

      if (error || !sbUser) {
        console.warn('[Auth] Supabase token invalid:', error?.message);
        return res.status(401).json({ message: 'Invalid or expired session token. Please login again.' });
      }

      // Determine if this is the designated admin email
      const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
      const isAdminEmail = sbUser.email.toLowerCase() === adminEmail;

      // Determine role — Prisma enum is UPPERCASE (CLIENT, ADMIN)
      const metaRole = sbUser.user_metadata?.role?.toUpperCase();
      const role = (isAdminEmail || metaRole === 'ADMIN') ? 'ADMIN' : 'CLIENT';

      // Find or create local Prisma user record (synced from Supabase)
      let localUser = await prisma.user.findUnique({ where: { email: sbUser.email } });

      if (!localUser) {
        // Create local record on first authenticated request
        console.log(`[Auth] First-time sync: creating local user for ${sbUser.email} with role ${role}`);
        localUser = await prisma.user.create({
          data: {
            id: sbUser.id,
            email: sbUser.email,
            name: sbUser.user_metadata?.full_name ||
                  `${sbUser.user_metadata?.first_name || ''} ${sbUser.user_metadata?.last_name || ''}`.trim() ||
                  sbUser.email.split('@')[0],
            role: role,
            updatedAt: new Date()
          }
        });
      } else if (isAdminEmail && localUser.role !== 'ADMIN') {
        // Ensure admin email always has ADMIN role
        localUser = await prisma.user.update({
          where: { id: localUser.id },
          data: { role: 'ADMIN' }
        });
      }

      req.user = {
        id: localUser.id,
        email: localUser.email,
        role: localUser.role,
        name: localUser.name,
      };

      console.log(`[Auth] Authenticated: ${req.user.email} (role: ${req.user.role})`);
      return next();

    } catch (err) {
      console.error('[Auth] Supabase auth error:', err.message);
      return res.status(401).json({ message: 'Authentication failed. Please login again.' });
    }
  }

  // No token provided
  return res.status(401).json({ message: 'No authentication token provided. Please login.' });
};

const authorize = (...roles) => {
  const uppercaseRoles = roles.map(r => r.toUpperCase());
  return (req, res, next) => {
    if (!req.user || !uppercaseRoles.includes(req.user.role)) {
      console.warn(`[Auth] Forbidden: ${req.user?.email} (${req.user?.role}) tried to access ${uppercaseRoles}-only route`);
      return res.status(403).json({ message: `Access denied. Required role: ${uppercaseRoles.join(' or ')}` });
    }
    next();
  };
};

module.exports = { protect, authorize };

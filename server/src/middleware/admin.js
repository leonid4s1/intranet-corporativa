// server/src/middleware/admin.js
export const adminMiddleware = (req, res, next) => {
  // Por seguridad: si no viene usuario, forzamos 401
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acceso denegado' });
  }
  next();
};

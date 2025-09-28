// server/src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Si ya se enviaron headers, delega a Express
  if (res.headersSent) return next(err);

  const isDev = process.env.NODE_ENV === 'development';

  // Log útil (no sueltes objetos enormes)
  console.error('[ErrorHandler]', err?.name || 'Error', err?.message);
  if (isDev && err?.stack) console.error(err.stack);

  // 1) JSON malformado en body (SyntaxError del express.json)
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      errors: [{ msg: 'JSON inválido en el cuerpo de la petición' }],
    });
  }

  // 2) Errores de validación (express-validator) - si llegan agregados
  if (err.errors && Array.isArray(err.errors)) {
    return res.status(400).json({
      success: false,
      errors: err.errors.map(e => ({
        msg: e.msg || e.message || 'Error de validación',
        param: e.param || e.path,
      })),
    });
  }

  // 3) Errores JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      errors: [{ msg: 'Token de autenticación inválido' }],
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      errors: [{ msg: 'Token expirado' }],
    });
  }

  // 4) Errores Mongoose
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map(e => ({
      msg: e.message,
      param: e.path || e.kind,
    }));
    return res.status(400).json({
      success: false,
      errors: details.length ? details : [{ msg: err.message || 'Error de validación' }],
    });
  }

  // Duplicados (índice único)
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    const field = fields[0] || 'campo';
    return res.status(409).json({
      success: false,
      errors: [{ msg: `Valor duplicado para ${field}`, param: field }],
    });
  }

  // CastError (ObjectId inválido u otros casteos)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      errors: [{ msg: `Valor inválido para ${err.path}`, param: err.path }],
    });
  }

  // 5) Fallback estándar
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    errors: [
      {
        msg: err.message || 'Error interno del servidor',
        ...(isDev && { stack: err.stack }),
      },
    ],
  });
};

export default errorHandler;

const errorHandler = (err, req, res, next) => {
  // Log para diagnostico
  console.error('[ErrorHandler]', err.message, err.stack);
  
  const statusCode = err.statusCode || 500;

  // Manejo especifico para errores de validacion (express-validator)
  if (err.errors && Array.isArray(err.errors)) {
    return res.status(400).json({
      success: false,
      errors: err.errors.map(e => ({
        msg: e.msg || e.message,
        param: e.param || e.path
      }))
    });
  }

  // Manejo de errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      errors: [{ msg: 'Token de autenticacion invalido' }]
    });
  }

  // Formato estandar de error
  res.status(statusCode).json({
    success: false,
    errors: [{
      msg: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }]
  });
};

export default errorHandler;
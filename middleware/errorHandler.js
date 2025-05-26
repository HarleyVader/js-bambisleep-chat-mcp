export const errorHandler = (error, req, res, next) => {
  const logger = req.app.locals.logger;
  
  logger.error('Unhandled error:', error);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = {
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.path
  };

  if (isDevelopment) {
    errorResponse.details = error.message;
    errorResponse.stack = error.stack;
  }

  res.status(error.status || 500).json(errorResponse);
};
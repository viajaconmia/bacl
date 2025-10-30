class CustomError extends Error {
  statusCode;
  errorCode;
  details;

  constructor(message, statusCode = 500, errorCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}
class ShortError extends Error {
  statusCode;

  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ShortError.prototype);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let responseMessage = "Ocurrió un error inesperado en el servidor.";
  let errorDetails = undefined;
  let errorCode = undefined;

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    responseMessage = err.message;
    errorCode = err.errorCode;
    errorDetails = err.details;
  } else {
    console.error("Error no capturado:", err);
    if (process.env.NODE_ENV === "production") {
      responseMessage = "Ocurrió un error inesperado.";
    } else {
      responseMessage = err.message || responseMessage;
      errorDetails = err.stack;
    }
  }

  const errorResponse = {
    message: responseMessage,
    data: null,
    error: {
      code: errorCode || "INTERNAL_SERVER_ERROR",
      message: responseMessage,
      details: errorDetails,
    },
  };

  res.status(statusCode).json(errorResponse);
};

module.exports = { errorHandler, CustomError, ShortError };

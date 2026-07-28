const { z } = require("zod");
const { CustomError } = require("../../middleware/errorHandler");

const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new CustomError(result.error.errors[0].message, 400, "VALIDATION_ERROR");
  }
  return result.data;
};

const validateArrayIds = (ids) =>
  validate(
    z.array(z.number().int().positive()).min(1, "Se requiere al menos un id"),
    ids,
  );

module.exports = { validate, validateArrayIds };

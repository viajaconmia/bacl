const { ShortError } = require("../../middleware/errorHandler");

class Validation {
  static email(email) {
    if (typeof email !== "string") throw new Error("error de tipado");
  }
  static password(password) {
    if (typeof password !== "string")
      throw new ShortError("El password debe ser un string");
    if (password.length < 8)
      throw new ShortError(
        "Contraseña invalida, debe ser mayor a 8 caracteres"
      );
  }
  static username(username) {
    if (typeof username !== "string")
      throw new Error("El user debe ser un string");
    if (username.length < 4)
      throw new ShortError("El username tiene pocos caracteres");
  }
}

module.exports = Validation;

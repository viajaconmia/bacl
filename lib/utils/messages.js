const ERROR = {
  PROPS: { EMPTY: "Faltan propiedades para editar" },
  ID: {
    EMPTY: "No se encontro el id",
    TYPE: "El ID no tiene el formato o tipo esperado",
  },
  PRICE: {
    EMPTY: "Falta el precio",
    INVALID: "El precio tiene un valor invalido",
  },
  FK: {
    EMPTY: "Falta el id de una FK",
    TYPE: "El ID de una FK no tiene el formato o tipo esperado",
  },
  DATES: { EMPTY: "Falta alguna fecha" },
  NUMBER: {
    TYPE: "El formato o tipo del numero no es el esperado",
    INVALID: "El numero tiene un valor invalido",
  },
  CHANGES: {
    EMPTY: "No se encontraron cambios",
  },
  SALDO: {
    INVALID: "El saldo tiene un valor invalido",
  },
};
module.exports = ERROR;

require("dotenv").config();

const DEPARTMENTS = {
  IA: "603403000018558029",
};

module.exports = {
  DEPARTMENTS,
  SALT_ROUNDS: process.env.SALT_ROUNDS,
  SECRET_KEY: process.env.SECRET_KEY,
};

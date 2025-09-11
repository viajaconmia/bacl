require("dotenv").config();

module.exports = {
  SALT_ROUNDS: process.env.SALT_ROUNDS,
  SECRET_KEY: process.env.SECRET_KEY,
};

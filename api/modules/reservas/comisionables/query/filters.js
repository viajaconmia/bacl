const applyLike = (builder, column, value) => {
  if (value) builder.addWhere(`${column} LIKE ?`, `%${value}%`);
};

const applyExact = (builder, column, value) => {
  if (value) builder.addWhere(`${column} = ?`, value);
};

module.exports = { applyLike, applyExact };

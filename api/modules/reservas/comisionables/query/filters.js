const applyLike = (builder, column, value) => {
  if (value) builder.addWhere(`${column} LIKE ?`, `%${value}%`);
};

const applyExact = (builder, column, value) => {
  if (value) builder.addWhere(`${column} = ?`, value);
};

const applyDateRange = (builder, column, from, to) => {
  if (from) builder.addWhere(`DATE(${column}) >= ?`, from);
  if (to) builder.addWhere(`DATE(${column}) <= ?`, to);
};

module.exports = { applyLike, applyExact, applyDateRange };

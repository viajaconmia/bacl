// helpers/addenda.js
const buildAddendaXmlFromJson = (jsonString, root = "NoktosAddenda") => {
  const safeJson =
    typeof jsonString === "string" ? jsonString : JSON.stringify(jsonString);

  return `<?xml version="1.0" encoding="UTF-8"?>
<${root}>
  <![CDATA[${safeJson}]]>
</${root}>`;
};

module.exports = { buildAddendaXmlFromJson };

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const API_KEY = process.env.APIKEY;
const API_STRIPE = process.env.API_STRIPE;
const valuesFacturama = {
  token: process.env.TOKEN_FACTURAMA || btoa("pruebanoktos:pruebasnoktos"),
  useragent: process.env.USERAGENT_FACTURAMA,
  url: process.env.URL_FACTURAMA || "https://apisandbox.facturama.mx/",
};

const API_STRIPE_TEST = process.env.API_STRIPE_TEST;
const API_SENDGRID = process.env.API_SENDGRID;

const SERVICE_ROLE_KEY_SPB = process.env.SERVICE_ROLE_KEY_SPB;

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  SERVICE_ROLE_KEY_SPB // 👈 aquí va la Service Role Key
);

module.exports = {
  API_KEY,
  API_STRIPE,
  API_STRIPE_TEST,
  API_SENDGRID,
  supabase,
  valuesFacturama,
};

import 'server-only';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('Falta MP_ACCESS_TOKEN');
  return new MercadoPagoConfig({ accessToken });
}

export const mpPreference = () => new Preference(client());
export const mpPayment = () => new Payment(client());

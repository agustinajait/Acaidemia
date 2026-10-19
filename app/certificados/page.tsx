import { redirect } from 'next/navigation';

export const metadata = { title: 'Verificar certificado' };

async function go(formData: FormData) {
  'use server';
  const code = String(formData.get('code') || '').trim().toUpperCase();
  if (code) redirect(`/certificados/${encodeURIComponent(code)}`);
}

export default function Verificar() {
  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1 style={{ fontSize: '1.7rem' }}>Verificar un certificado</h1>
        <p className="muted">Ingresá el código que figura debajo del QR del certificado.</p>
        <form action={go} className="row">
          <input type="text" name="code" placeholder="ACA-XXXXX-XXXXX" required style={{ flex: 1, textTransform: 'uppercase' }} />
          <button className="btn" type="submit">Verificar</button>
        </form>
      </div>
    </div>
  );
}

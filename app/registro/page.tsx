import Link from 'next/link';
import { signUp } from '../actions/auth';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Crear cuenta' };

export default async function Registro({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '/mi-cuenta', error } = await searchParams;
  return (
    <div className="container section" style={{ maxWidth: 440 }}>
      <div className="card">
        <h1 style={{ fontSize: '1.7rem' }}>Crear cuenta</h1>
        <Flash error={error} />
        <form action={signUp}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="full_name">Nombre y apellido</label>
            <input id="full_name" name="full_name" type="text" required minLength={3} autoComplete="name" />
            <div className="hint">Así va a figurar en tus certificados.</div>
          </div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
          <button className="btn block" type="submit">Crear cuenta</button>
        </form>
        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>¿Ya tenés cuenta? <Link href={`/ingresar?next=${encodeURIComponent(next)}`}>Ingresá</Link></p>
      </div>
    </div>
  );
}

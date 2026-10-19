import Link from 'next/link';
import { signIn } from '../actions/auth';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Ingresar' };

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; ok?: string }> }) {
  const { next = '/mi-cuenta', error, ok } = await searchParams;
  return (
    <div className="container section" style={{ maxWidth: 440 }}>
      <div className="card">
        <h1 style={{ fontSize: '1.7rem' }}>Ingresar</h1>
        <Flash error={error} ok={ok} />
        <form action={signIn}>
          <input type="hidden" name="next" value={next} />
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
          <button className="btn block" type="submit">Ingresar</button>
        </form>
        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>¿No tenés cuenta? <Link href={`/registro?next=${encodeURIComponent(next)}`}>Creala acá</Link></p>
      </div>
    </div>
  );
}

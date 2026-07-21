'use client';

import Link from 'next/link';
import { useState } from 'react';

import Nav from '@/components/Nav';
import { ensureWorkspace, login } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('demo@ascend.test');
  const [password, setPassword] = useState('Demo12345!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      await ensureWorkspace();
      window.setTimeout(() => { location.href = '/dashboard'; }, 260);
    } catch {
      setError('No pudimos verificar esos datos. Revisa tu correo y contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return <><Nav/><main className="auth-shell ascend-auth login-experience">
    <section className="auth-panel">
      <div className="auth-card login-card">
        <header className="login-heading"><div className="eyebrow">Workspace seguro</div><h1>Vuelve a tu estudio.</h1><p className="auth-lead">Continúa exactamente donde lo dejaste: proyectos, recursos y decisiones creativas permanecen conectados.</p></header>
        {error && <div className="error login-error" role="alert" aria-live="assertive"><span>!</span><div><strong>No fue posible ingresar</strong><p>{error}</p></div></div>}
        <form onSubmit={submit} aria-busy={busy}>
          <label className="field"><span>Correo electrónico</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@empresa.com" disabled={busy} required/></label>
          <label className="field"><span>Contraseña</span><div className="password-field"><input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></label>
          <div className="auth-options"><label><input type="checkbox"/> <span>Mantener mi sesión</span></label><Link href="/login">Recuperar acceso</Link></div>
          <button className="btn primary auth-submit" disabled={busy}><span>{busy ? 'Verificando acceso…' : 'Entrar al estudio'}</span><b aria-hidden="true">→</b></button>
        </form>
        <div className="login-trust"><span><i/>Sesión protegida</span><span>Credenciales cifradas</span></div>
        <p className="auth-alternate">¿Aún no tienes un espacio? <Link href="/register">Crear un estudio</Link></p>
      </div>
    </section>
    <section className="auth-visual login-visual" aria-label="Dirección creativa de Ascend">
      <div className="login-visual-meta"><span>ASCEND / CREATIVE SYSTEM</span><span>2026 — STUDIO 01</span></div>
      <div className="auth-campaign"><span>ART DIRECTION / 04:05</span><h2>Ideas con<br/>dirección.</h2><p>Inteligencia creativa para marcas que cuidan cada detalle.</p><i/></div>
      <div className="login-visual-note"><small>Creative principle</small><blockquote>“La precisión también puede sentirse.”</blockquote></div>
    </section>
  </main></>;
}

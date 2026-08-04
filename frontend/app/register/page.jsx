'use client';

import { useState } from 'react';

import Nav from '@/components/Nav';
import { api, ensureWorkspace, login } from '@/lib/api';
import { usePublicSessionRedirect } from '@/hooks/usePublicSessionRedirect';

const steps = ['Cuenta', 'Espacio', 'Contexto'];

export default function Register() {
  const sessionStatus = usePublicSessionRedirect();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', account_type: 'individual', workspace_name: '', legal_name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (sessionStatus !== 'anonymous') return null;

  const strength = form.password.length > 11 ? 'Alta' : form.password.length > 7 ? 'Media' : 'Baja';

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!accepted) {
      setError('Debes aceptar los términos para crear tu cuenta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/auth/register/', { method: 'POST', body: JSON.stringify(form) });
      await login(form.email, form.password);
      await ensureWorkspace();
      location.href = '/onboarding';
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <><Nav/><main className="auth-shell ascend-auth register-auth"><section className="auth-panel"><div className="auth-card"><div className="eyebrow">Nuevo estudio</div><h1>Crea tu espacio.</h1><p className="auth-lead">Configura lo esencial. Tu sistema de marca y catálogo vendrán después.</p>{error && <div className="error" role="alert">{error}</div>}<nav className="register-steps" aria-label="Progreso del registro">{steps.map((label, index) => <button type="button" key={label} className={`${step === index ? 'active' : ''} ${step > index ? 'done' : ''}`} onClick={() => index <= step && setStep(index)} disabled={index > step}><i>{step > index ? '✓' : index + 1}</i><span>{label}</span></button>)}</nav><form onSubmit={submit}>{step === 0 && <section className="register-section"><div className="register-two"><label className="field"><span>Nombre</span><input className="input" name="first_name" value={form.first_name} onChange={update} autoComplete="given-name" required/></label><label className="field"><span>Apellido</span><input className="input" name="last_name" value={form.last_name} onChange={update} autoComplete="family-name" required/></label></div><label className="field"><span>Correo</span><input className="input" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required/></label><label className="field"><span>Contraseña</span><input className="input" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" minLength={8} required/><small>Fortaleza: <b>{strength}</b> · mínimo 8 caracteres</small></label><label className="terms-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>Acepto los términos y la política de privacidad.</span></label></section>}{step === 1 && <section className="account-choices"><button type="button" className={form.account_type === 'individual' ? 'active' : ''} onClick={() => setForm(current => ({ ...current, account_type: 'individual' }))}><i>◎</i><span><b>Estudio individual</b><small>Para profesionales y negocios que gestionan su propio catálogo.</small></span></button><button type="button" className={form.account_type === 'company' ? 'active' : ''} onClick={() => setForm(current => ({ ...current, account_type: 'company' }))}><i>⌘</i><span><b>Workspace de empresa</b><small>Para equipos que comparten marca, productos y contenido.</small></span></button></section>}{step === 2 && <section className="register-section"><label className="field"><span>{form.account_type === 'company' ? 'Nombre comercial' : 'Nombre del estudio'}</span><input className="input" name="workspace_name" value={form.workspace_name} onChange={update} placeholder="Ej. Norte Creative" required/></label>{form.account_type === 'company' && <label className="field"><span>Razón social</span><input className="input" name="legal_name" value={form.legal_name} onChange={update}/></label>}<div className="register-two"><label className="field"><span>País</span><input className="input" value="Perú" readOnly/></label><label className="field"><span>{form.account_type === 'company' ? 'Tamaño del equipo' : 'Actividad'}</span><input className="input" placeholder={form.account_type === 'company' ? '1–10 personas' : 'Moda, restaurante…'}/></label></div></section>}<footer className="register-actions"><button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep(current => current - 1)}>Atrás</button>{step < steps.length - 1 ? <button type="button" className="btn btn-primary" onClick={() => setStep(current => current + 1)}>Continuar →</button> : <button className="btn btn-primary" disabled={busy}>{busy ? 'Creando estudio…' : 'Crear mi estudio'}</button>}</footer></form></div></section><section className="auth-visual"><div className="auth-campaign register-campaign"><span>ASCEND / STUDIO SYSTEM</span><h2>Tu visión.<br/>Un sistema.</h2><p>Marca, productos y creatividad trabajando en una misma dirección.</p><i/></div><blockquote>“Las grandes campañas empiezan con fundamentos claros.”</blockquote></section></main></>;
}

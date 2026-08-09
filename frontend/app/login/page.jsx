"use client";

import Link from "next/link";
import { useState } from "react";

import Nav from "@/components/Nav";
import { ensureWorkspace, login } from "@/lib/api";
import { usePublicSessionRedirect } from "@/hooks/usePublicSessionRedirect";

const preservedContext = [
  {
    number: "01",
    title: "Sistema de marca",
    detail: "Brand Kit · reglas · voz",
  },
  {
    number: "02",
    title: "Inteligencia",
    detail: "Perfiles · pains · angles",
  },
  {
    number: "03",
    title: "Recursos",
    detail: "Productos · referencias",
  },
  {
    number: "04",
    title: "Dirección creativa",
    detail: "Templates · recipes",
  },
  {
    number: "05",
    title: "Producción",
    detail: "Projects · jobs · outputs",
  },
];

function EyeIcon({ open = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Z" />
      <circle cx="12" cy="12" r="2.7" />

      {open ? <path d="M4 4 20 20" /> : null}
    </svg>
  );
}

export default function Login() {
  const sessionStatus = usePublicSessionRedirect();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  if (sessionStatus !== "anonymous") {
    return null;
  }

  async function submit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      await login(email, password);

      await ensureWorkspace();

      window.setTimeout(() => {
        location.href = "/dashboard";
      }, 200);
    } catch {
      setError(
        "No pudimos verificar esos datos. Revisa tu correo y contraseña.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />

      <main className="auth-shell auth-shell--premium">
        <section className="auth-panel auth-panel--login">
          <div className="auth-card auth-card--premium">
            <header className="premium-auth-heading">
              <span className="premium-auth-kicker">ASCEND / ACCESS</span>

              <h1>
                Vuelve a
                <br />
                tu estudio.
              </h1>

              <p>
                Tu contexto creativo sigue disponible. Continúa desde el sistema
                que ya construiste.
              </p>
            </header>

            {error ? (
              <div
                className="premium-auth-error"
                role="alert"
                aria-live="assertive"
              >
                <span>!</span>

                <div>
                  <strong>No fue posible ingresar</strong>

                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            <form
              className="premium-auth-form"
              onSubmit={submit}
              aria-busy={busy}
            >
              <label className="premium-auth-field">
                <span>Correo electrónico</span>

                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  disabled={busy}
                  required
                />
              </label>

              <label className="premium-auth-field">
                <span>Contraseña</span>

                <div className="premium-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>

              <div className="premium-auth-session">
                <span>
                  <i />
                  Contexto persistente
                </span>

                <small>
                  Tu workspace se recuperará después de iniciar sesión.
                </small>
              </div>

              <button
                className="btn btn-primary premium-auth-submit"
                disabled={busy}
              >
                <span>
                  {busy ? "Verificando acceso…" : "Entrar al estudio"}
                </span>

                <b>→</b>
              </button>
            </form>

            <footer className="premium-auth-footer">
              <div>
                <span>
                  <i />
                  Sesión protegida
                </span>

                <span>Workspace persistente</span>
              </div>

              <p>
                ¿Aún no tienes un espacio?{" "}
                <Link href="/register">Crear estudio</Link>
              </p>
            </footer>
          </div>
        </section>

        <section className="auth-memory-stage">
          <header className="auth-memory-stage__meta">
            <span>ASCEND / CREATIVE MEMORY</span>

            <span>CONTEXT PRESERVED</span>
          </header>

          <div className="auth-memory-stage__copy">
            <span>TU SISTEMA SIGUE AQUÍ</span>

            <h2>
              Continúa.
              <br />
              No recomiences.
            </h2>

            <p>
              Ascend conserva aquello que ya definiste para que tu siguiente
              campaña comience desde el contexto acumulado.
            </p>
          </div>

          <div className="auth-memory-architecture">
            <div className="auth-memory-center">
              <span>ASCEND</span>

              <strong>Workspace</strong>

              <small>Creative memory</small>
            </div>

            <div className="auth-memory-orbit auth-memory-orbit--one" />
            <div className="auth-memory-orbit auth-memory-orbit--two" />

            {preservedContext.map((item, index) => (
              <article
                key={item.number}
                className={`auth-memory-node auth-memory-node--${index + 1}`}
              >
                <span>{item.number}</span>

                <div>
                  <strong>{item.title}</strong>

                  <small>{item.detail}</small>
                </div>

                <i>✓</i>
              </article>
            ))}
          </div>

          <footer className="auth-memory-stage__principle">
            <span>Creative principle</span>

            <strong>
              Lo que ya definiste no debería convertirse nuevamente en trabajo.
            </strong>
          </footer>
        </section>
      </main>
    </>
  );
}

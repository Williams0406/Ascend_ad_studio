"use client";

import Link from "next/link";
import { useState } from "react";

import Nav from "@/components/Nav";
import { api, ensureWorkspace, login } from "@/lib/api";
import { usePublicSessionRedirect } from "@/hooks/usePublicSessionRedirect";

const steps = [
  {
    label: "Cuenta",
    description: "Tu acceso",
  },
  {
    label: "Tipo",
    description: "Cómo trabajarás",
  },
  {
    label: "Estudio",
    description: "Tu workspace",
  },
];

const setupJourney = [
  {
    number: "01",
    title: "Brand Kit",
    description: "Identidad, voz y reglas.",
  },
  {
    number: "02",
    title: "Productos",
    description: "Catálogo y recursos.",
  },
  {
    number: "03",
    title: "Inteligencia",
    description: "Perfiles y estrategia.",
  },
  {
    number: "04",
    title: "Dirección",
    description: "Templates y referencias.",
  },
];

export default function Register() {
  const sessionStatus = usePublicSessionRedirect();

  const [step, setStep] = useState(0);

  const [accepted, setAccepted] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    account_type: "individual",
    workspace_name: "",
    legal_name: "",
  });

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  if (sessionStatus !== "anonymous") {
    return null;
  }

  const strength =
    form.password.length >= 12
      ? "Alta"
      : form.password.length >= 8
        ? "Media"
        : "Baja";

  function update(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (
        !form.first_name.trim() ||
        !form.last_name.trim() ||
        !form.email.trim()
      ) {
        setError("Completa tu nombre, apellido y correo para continuar.");

        return false;
      }

      if (form.password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");

        return false;
      }

      if (!accepted) {
        setError("Debes aceptar los términos y la política de privacidad.");

        return false;
      }
    }

    if (step === 2 && !form.workspace_name.trim()) {
      setError("Indica el nombre de tu estudio o workspace.");

      return false;
    }

    setError("");

    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(event) {
    event.preventDefault();

    if (!validateCurrentStep()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api("/auth/register/", {
        method: "POST",
        body: JSON.stringify(form),
      });

      await login(form.email, form.password);

      await ensureWorkspace();

      location.href = "/dashboard";
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />

      <main className="auth-shell auth-shell--premium auth-shell--register">
        <section className="auth-panel">
          <div className="auth-card auth-card--premium auth-register-card">
            <header className="premium-auth-heading">
              <span className="premium-auth-kicker">
                ASCEND / NEW WORKSPACE
              </span>

              <h1>
                Crea tu
                <br />
                estudio.
              </h1>

              <p>
                Abriremos únicamente la estructura inicial. Tu marca y tus
                recursos se configuran después y quedan disponibles para
                reutilizarlos.
              </p>
            </header>

            <div className="auth-setup-once">
              <span>PRINCIPIO ASCEND</span>

              <strong>Configura una vez. Reutiliza después.</strong>

              <small>
                No tendrás que reconstruir tu Brand Kit en cada campaña.
              </small>
            </div>

            <nav
              className="premium-register-steps"
              aria-label="Progreso del registro"
            >
              {steps.map((item, index) => (
                <button
                  type="button"
                  key={item.label}
                  className={[
                    step === index ? "active" : "",
                    step > index ? "done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (index <= step) {
                      setError("");
                      setStep(index);
                    }
                  }}
                  disabled={index > step}
                >
                  <i>{step > index ? "✓" : index + 1}</i>

                  <span>
                    <strong>{item.label}</strong>

                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </nav>

            {error ? (
              <div className="premium-auth-error" role="alert">
                <span>!</span>

                <div>
                  <strong>Revisa esta información</strong>

                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            <form className="premium-register-form" onSubmit={submit}>
              {step === 0 ? (
                <section className="premium-register-section">
                  <header>
                    <span>PASO 01 / CUENTA</span>

                    <h3>Crea tu acceso</h3>

                    <p>
                      Estos datos identifican al usuario que administra el
                      workspace.
                    </p>
                  </header>

                  <div className="premium-auth-two">
                    <label className="premium-auth-field">
                      <span>Nombre</span>

                      <input
                        name="first_name"
                        value={form.first_name}
                        onChange={update}
                        autoComplete="given-name"
                        required
                      />
                    </label>

                    <label className="premium-auth-field">
                      <span>Apellido</span>

                      <input
                        name="last_name"
                        value={form.last_name}
                        onChange={update}
                        autoComplete="family-name"
                        required
                      />
                    </label>
                  </div>

                  <label className="premium-auth-field">
                    <span>Correo electrónico</span>

                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={update}
                      autoComplete="email"
                      placeholder="nombre@empresa.com"
                      required
                    />
                  </label>

                  <label className="premium-auth-field">
                    <span>Contraseña</span>

                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={update}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />

                    <small>
                      Fortaleza: <strong>{strength}</strong>
                      {" · "}
                      mínimo 8 caracteres
                    </small>
                  </label>

                  <label className="premium-terms">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(event) => {
                        setAccepted(event.target.checked);

                        if (error) {
                          setError("");
                        }
                      }}
                    />

                    <span>
                      Acepto los términos y la política de privacidad.
                    </span>
                  </label>
                </section>
              ) : null}

              {step === 1 ? (
                <section className="premium-register-section">
                  <header>
                    <span>PASO 02 / TIPO</span>

                    <h3>¿Cómo trabajarás?</h3>

                    <p>
                      Esto solo define la organización inicial del workspace.
                    </p>
                  </header>

                  <div className="premium-account-types">
                    <button
                      type="button"
                      className={
                        form.account_type === "individual" ? "active" : ""
                      }
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          account_type: "individual",
                        }))
                      }
                    >
                      <span>01</span>

                      <div>
                        <strong>Estudio individual</strong>

                        <p>
                          Profesionales, emprendedores o negocios administrando
                          su propio sistema.
                        </p>
                      </div>

                      <i>{form.account_type === "individual" ? "●" : "○"}</i>
                    </button>

                    <button
                      type="button"
                      className={
                        form.account_type === "company" ? "active" : ""
                      }
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          account_type: "company",
                        }))
                      }
                    >
                      <span>02</span>

                      <div>
                        <strong>Workspace de empresa</strong>

                        <p>
                          Organizaciones que centralizan marca, catálogo y
                          producción.
                        </p>
                      </div>

                      <i>{form.account_type === "company" ? "●" : "○"}</i>
                    </button>
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section className="premium-register-section">
                  <header>
                    <span>PASO 03 / WORKSPACE</span>

                    <h3>Nombra tu estudio</h3>

                    <p>
                      Este será el espacio que conservará el contexto de tu
                      sistema.
                    </p>
                  </header>

                  <label className="premium-auth-field">
                    <span>
                      {form.account_type === "company"
                        ? "Nombre comercial"
                        : "Nombre del estudio"}
                    </span>

                    <input
                      name="workspace_name"
                      value={form.workspace_name}
                      onChange={update}
                      placeholder="Ej. Norte Creative"
                      required
                    />
                  </label>

                  {form.account_type === "company" ? (
                    <label className="premium-auth-field">
                      <span>Razón social</span>

                      <input
                        name="legal_name"
                        value={form.legal_name}
                        onChange={update}
                      />
                    </label>
                  ) : null}

                  <div className="premium-register-ready">
                    <span>DESPUÉS</span>

                    <strong>Dashboard → guía de configuración</strong>

                    <p>
                      Ascend te guiará para preparar los elementos persistentes
                      sin obligarte a completar todo ahora.
                    </p>
                  </div>
                </section>
              ) : null}

              <footer className="premium-register-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={step === 0 || busy}
                  onClick={() => {
                    setError("");

                    setStep((current) => Math.max(current - 1, 0));
                  }}
                >
                  ← Atrás
                </button>

                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={nextStep}
                  >
                    Continuar
                    <span>→</span>
                  </button>
                ) : (
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Creando estudio…" : "Crear mi estudio"}
                  </button>
                )}
              </footer>
            </form>

            <p className="premium-auth-alternate">
              ¿Ya tienes un workspace? <Link href="/login">Ingresar</Link>
            </p>
          </div>
        </section>

        <section className="register-system-stage">
          <header>
            <span>ASCEND / GETTING STARTED</span>

            <span>SET ONCE · REUSE</span>
          </header>

          <div className="register-system-stage__copy">
            <small>DESPUÉS DEL REGISTRO</small>

            <h2>
              Construye contexto.
              <br />
              No formularios.
            </h2>

            <p>
              Configura cada capa cuando la necesites. Lo que prepares seguirá
              disponible en futuras campañas.
            </p>
          </div>

          <div className="register-system-flow">
            <span className="register-system-flow__line" />

            {setupJourney.map((item) => (
              <article key={item.number}>
                <span>{item.number}</span>

                <div>
                  <strong>{item.title}</strong>

                  <small>{item.description}</small>
                </div>

                <i>✓</i>
              </article>
            ))}
          </div>

          <div className="register-system-result">
            <span>RESULTADO</span>

            <strong>
              Un contexto.
              <br />
              Muchas campañas.
            </strong>

            <small>Project → Jobs → Results</small>
          </div>
        </section>
      </main>
    </>
  );
}

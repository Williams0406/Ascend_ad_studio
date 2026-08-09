"use client";

import Link from "next/link";

import Nav from "@/components/Nav";
import { usePublicSessionRedirect } from "@/hooks/usePublicSessionRedirect";

const persistentContext = [
  {
    index: "01",
    name: "Brand Kit",
    meta: "Identidad · Voz · Reglas",
    tone: "copper",
  },
  {
    index: "02",
    name: "Brand Intelligence",
    meta: "Persona · Pain · Angle · Emotion",
    tone: "lavender",
  },
  {
    index: "03",
    name: "Products",
    meta: "Catálogo · Assets · Información",
    tone: "sage",
  },
  {
    index: "04",
    name: "Creative Direction",
    meta: "Templates · Recipes · References",
    tone: "sky",
  },
];

const advantages = [
  {
    number: "01",
    eyebrow: "Menos repetición",
    title: "Configura una vez.",
    description:
      "La identidad, el catálogo, los perfiles estratégicos y la dirección creativa viven en el workspace, no dentro de cada campaña.",
  },
  {
    number: "02",
    eyebrow: "Más contexto",
    title: "Cada proyecto empieza más adelante.",
    description:
      "Ascend reúne información reutilizable con las decisiones particulares de la campaña antes de construir el trabajo de generación.",
  },
  {
    number: "03",
    eyebrow: "Control real",
    title: "Automatiza sin perder supervisión.",
    description:
      "Concept Planner puede preparar conceptos y GenerationJobs, pero la revisión y el dispatch siguen bajo tu control.",
  },
];

const pipeline = [
  {
    number: "01",
    title: "Context",
    description: "Brand, producto, perfil, referencias y template.",
  },
  {
    number: "02",
    title: "Creative plan",
    description: "Decisiones comerciales, copy y dirección.",
  },
  {
    number: "03",
    title: "Generation jobs",
    description: "Configuraciones independientes y auditables.",
  },
  {
    number: "04",
    title: "Review",
    description: "Verifica qué se generará antes de ejecutar.",
  },
  {
    number: "05",
    title: "Dispatch",
    description: "Producción cuando tú decides.",
  },
];

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function SparkIcon() {
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
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 12 4 4 8-9" />
    </svg>
  );
}

function StudioProductVisual() {
  return (
    <div className="public-studio-product">
      <div className="public-studio-product__ambient" />

      <span className="public-studio-product__eyebrow">
        PRODUCT / CAMPAIGN 01
      </span>

      <div className="public-studio-product__object">
        <span>ASCEND</span>
      </div>

      <div className="public-studio-product__copy">
        <strong>Una dirección.</strong>
        <span>Muchas variaciones.</span>
      </div>

      <div className="public-studio-product__meta">
        <span>4:5</span>
        <span>Editorial</span>
      </div>
    </div>
  );
}

function CampaignWorkspacePreview() {
  return (
    <div className="landing-live-workspace">
      <header className="landing-live-workspace__topbar">
        <div className="landing-live-workspace__identity">
          <span>Ascend Creative Intelligence</span>
          <strong>Proyecto activo</strong>
        </div>

        <div className="landing-live-workspace__project">
          <i />
          Product Launch / 01
        </div>

        <div className="landing-live-workspace__queue">
          <span>Configuraciones</span>
          <strong>3</strong>
        </div>

        <div className="landing-live-workspace__exit">Salir</div>
      </header>

      <div className="landing-live-workspace__body">
        {/* DIRECCIÓN */}
        <section className="landing-live-column landing-live-column--direction">
          <header className="landing-live-column__header">
            <span className="landing-live-column__number">01</span>

            <div>
              <small>Dirección</small>
              <strong>Brief creativo</strong>
              <p>Mensaje, audiencia y objetivo.</p>
            </div>

            <i>‹</i>
          </header>

          <div className="landing-live-column__content">
            <LandingField label="Recipe" value="Product Editorial" />

            <LandingField label="Creative angle" value="Product confidence" />

            <LandingField label="Nombre" value="Launch / Core 01" />

            <LandingField label="Campaign theme" value="Confianza sin exceso" />

            <div className="landing-live-textarea">
              <span>Headline</span>

              <strong>
                Designed to
                <br />
                move forward.
              </strong>
            </div>

            <LandingField label="Call to action" value="Descubrir" />

            <div className="landing-live-profile">
              <span>Perfil estratégico</span>

              <strong>Professional Explorer</strong>

              <small>Ambición · Control · Claridad</small>
            </div>
          </div>

          <footer className="landing-live-add">
            <span>＋</span>

            <div>
              <small>Cola de generación</small>
              <strong>Agregar configuración</strong>
            </div>

            <b>→</b>
          </footer>
        </section>

        {/* CONTEXTO */}
        <section className="landing-live-column landing-live-column--context">
          <header className="landing-live-column__header">
            <span className="landing-live-column__number">02</span>

            <div>
              <small>Contexto</small>
              <strong>Fuentes y recursos</strong>
              <p>Elementos que interpreta la IA.</p>
            </div>

            <i>‹</i>
          </header>

          <div className="landing-live-column__content">
            <LandingField label="Producto" value="Core / 02" />

            <div className="landing-live-spec">
              <div className="landing-live-spec__image">
                <span>ASC</span>
              </div>

              <div>
                <small>Producto activo</small>
                <strong>Core / 02</strong>
                <span>Premium goods</span>
              </div>
            </div>

            <LandingField label="Template" value="Editorial Hero" />

            <div className="landing-live-brandkit">
              <div>
                <strong>Brand Kit</strong>
                <small>Colores, voz y restricciones.</small>
              </div>

              <span>
                <i />
              </span>
            </div>

            <div className="landing-live-assets">
              <header>
                <span>Assets del proyecto</span>
                <strong>Imagen del producto</strong>
              </header>

              <nav>
                <span className="active">
                  Producto <b>1</b>
                </span>

                <span>
                  Fondo <b>0</b>
                </span>

                <span>
                  Lifestyle <b>2</b>
                </span>
              </nav>

              <div className="landing-live-asset-grid">
                <div className="active">
                  <span>01</span>
                </div>

                <div>
                  <span>02</span>
                </div>

                <div>
                  <span>03</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROYECTOS */}
        <section className="landing-live-projects">
          <header>
            <span className="landing-live-projects__icon">▱</span>

            <div>
              <small>Vista complementaria</small>

              <strong>Proyectos</strong>

              <p>Destino de resultados.</p>
            </div>
          </header>

          <div className="landing-live-project-search">
            ⌕<span>Buscar proyecto…</span>
          </div>

          <nav>
            <span className="active">Todos</span>
            <span>Recientes</span>
          </nav>

          <div className="landing-live-project-list">
            <div className="active">
              <span>PL</span>

              <div>
                <strong>Product Launch</strong>

                <small>8 resultados</small>
              </div>

              <b>☆</b>
            </div>

            <div>
              <span>BR</span>

              <div>
                <strong>Brand Refresh</strong>

                <small>4 resultados</small>
              </div>

              <b>☆</b>
            </div>

            <div>
              <span>SM</span>

              <div>
                <strong>Social / May</strong>

                <small>12 resultados</small>
              </div>

              <b>☆</b>
            </div>
          </div>

          <footer>＋ Nuevo proyecto</footer>
        </section>

        {/* CANVAS */}
        <section className="landing-live-canvas">
          <header>
            <div>
              <small>03 / Canvas</small>

              <strong>Dirección en construcción</strong>
            </div>

            <div className="landing-live-canvas__tools">
              <span>Fit</span>
              <span>100%</span>
              <b>4:5 · 1K</b>
            </div>
          </header>

          <div className="landing-live-stage">
            <div className="landing-live-ad">
              <span className="landing-live-ad__eyebrow">
                ASCEND / PRODUCT 02
              </span>

              <div className="landing-live-ad__orbit" />

              <div className="landing-live-ad__product">
                <span>ASCEND</span>
              </div>

              <div className="landing-live-ad__copy">
                <strong>
                  Designed to
                  <br />
                  move forward.
                </strong>

                <small>CORE / PREMIUM SERIES</small>
              </div>
            </div>
          </div>

          <div className="landing-live-results">
            <header>
              <div>
                <small>Resultados</small>
                <strong>Biblioteca de generaciones</strong>
              </div>

              <span>8 resultados</span>
            </header>

            <div>
              {[1, 2, 3, 4].map((item) => (
                <span key={item} className={item === 1 ? "active" : ""}>
                  <i />
                  <small>0{item}</small>
                </span>
              ))}

              <button type="button" tabIndex={-1}>
                GENERAR
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LandingField({ label, value }) {
  return (
    <div className="landing-live-field">
      <span>{label}</span>
      <strong>{value}</strong>
      <i>⌄</i>
    </div>
  );
}

function ContextArchitecture() {
  return (
    <div className="public-context-architecture">
      <div className="public-context-architecture__origin">
        <span>WORKSPACE</span>

        <strong>
          Configura
          <br />
          una vez.
        </strong>

        <p>
          El conocimiento persistente permanece disponible para nuevas campañas.
        </p>
      </div>

      <div className="public-context-architecture__resources">
        {persistentContext.map((item) => (
          <article
            key={item.name}
            className={`public-context-resource public-context-resource--${item.tone}`}
          >
            <span>{item.index}</span>

            <div>
              <strong>{item.name}</strong>
              <small>{item.meta}</small>
            </div>

            <i />
          </article>
        ))}
      </div>

      <div className="public-context-architecture__connector">
        <span />
        <i />
        <span />
      </div>

      <div className="public-context-architecture__destination">
        <span>CAMPAIGN</span>

        <strong>
          Reutiliza
          <br />
          cada vez.
        </strong>

        <small>Project → GenerationJob</small>
      </div>
    </div>
  );
}

function WorkflowChoice({
  type,
  label,
  title,
  description,
  items,
  href,
  action,
}) {
  return (
    <article className={`public-path public-path--${type}`}>
      <header>
        <span>{label}</span>

        <div className="public-path__signal">
          <i />
          <i />
          <i />
        </div>
      </header>

      <div className="public-path__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item}>
            <span>
              <CheckIcon />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <Link href={href}>
        {action}
        <ArrowIcon />
      </Link>
    </article>
  );
}

export default function Home() {
  const sessionStatus = usePublicSessionRedirect({
    redirect: false,
  });

  const authenticated = sessionStatus === "authenticated";

  return (
    <>
      <Nav />

      <main className="landing-page public-home">
        {/* HERO */}
        <section className="public-hero">
          <div className="public-hero__ambient public-hero__ambient--one" />
          <div className="public-hero__ambient public-hero__ambient--two" />

          <div className="public-hero__copy">
            <div className="public-kicker">
              <span>ASCEND / CREATIVE INTELLIGENCE</span>
              <i />
            </div>

            <h1>
              Convierte tu marca
              <br />
              en un <span>sistema creativo.</span>
            </h1>

            <p>
              Centraliza identidad, productos, inteligencia de audiencia y
              dirección visual para que cada campaña empiece con contexto, no
              desde cero.
            </p>

            <div className="public-hero__actions">
              {authenticated ? (
                <Link
                  className="btn btn-primary public-primary-action"
                  href="/dashboard"
                >
                  Entrar al estudio
                  <ArrowIcon />
                </Link>
              ) : sessionStatus === "anonymous" ? (
                <>
                  <Link
                    className="btn btn-primary public-primary-action"
                    href="/register"
                  >
                    Crear mi estudio
                    <ArrowIcon />
                  </Link>

                  <Link className="public-secondary-action" href="/login">
                    Ya tengo una cuenta
                  </Link>
                </>
              ) : null}
            </div>

            <div className="public-hero__proof">
              <div>
                <strong>01</strong>
                <span>Contexto persistente</span>
              </div>

              <div>
                <strong>02</strong>
                <span>Planificación asistida</span>
              </div>

              <div>
                <strong>03</strong>
                <span>Generación trazable</span>
              </div>
            </div>
          </div>

          <div className="public-hero__product">
            <div className="public-hero__preview-label">
              <span>LIVE SYSTEM PREVIEW</span>
              <i />
              <small>Workspace / active</small>
            </div>

            <CampaignWorkspacePreview />
          </div>
        </section>

        {/* POSITIONING STRIP */}
        <section className="public-system-strip">
          <div>
            <span>ASCEND SYSTEM</span>
            <strong>Context</strong>
          </div>

          <i />

          <div>
            <span>01</span>
            <strong>Plan</strong>
          </div>

          <i />

          <div>
            <span>02</span>
            <strong>Jobs</strong>
          </div>

          <i />

          <div>
            <span>03</span>
            <strong>Review</strong>
          </div>

          <i />

          <div>
            <span>04</span>
            <strong>Generate</strong>
          </div>
        </section>

        {/* PRINCIPLE */}
        <section className="public-editorial-statement">
          <div className="public-editorial-statement__index">
            <span>01</span>
            <i />
            <small>PRINCIPIO</small>
          </div>

          <div className="public-editorial-statement__copy">
            <h2>
              Una campaña nueva no debería obligarte a volver a explicar quién
              eres.
            </h2>

            <p>
              Ascend separa el conocimiento que cambia lentamente de las
              decisiones que cambian campaña por campaña. El resultado es un
              sistema creativo que conserva contexto y reduce trabajo
              repetitivo.
            </p>
          </div>
        </section>

        {/* VALUE */}
        <section className="public-value-section">
          <header className="public-section-heading">
            <div>
              <span>02 / POR QUÉ ASCEND</span>
              <h2>Menos coordinación. Más dirección.</h2>
            </div>

            <p>
              La automatización aporta valor cuando elimina repetición sin
              esconder las decisiones importantes.
            </p>
          </header>

          <div className="public-value-grid">
            {advantages.map((item) => (
              <article key={item.number}>
                <header>
                  <span>{item.number}</span>
                  <small>{item.eyebrow}</small>
                </header>

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>

                <i />
              </article>
            ))}
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section className="public-context-section">
          <header className="public-section-heading">
            <div>
              <span>03 / CONTEXT ARCHITECTURE</span>
              <h2>
                Lo permanente vive
                <br />
                fuera de la campaña.
              </h2>
            </div>

            <p>
              Marca, estrategia, catálogo y dirección permanecen disponibles en
              el workspace y se conectan únicamente cuando una campaña los
              necesita.
            </p>
          </header>

          <ContextArchitecture />
        </section>

        {/* PRODUCT PREVIEW */}
        <section className="public-product-section">
          <div className="public-product-section__visual">
            <div className="public-product-art">
              <span className="public-product-art__index">PRODUCT / 08</span>

              <div className="public-product-art__shape public-product-art__shape--one" />
              <div className="public-product-art__shape public-product-art__shape--two" />

              <div className="public-product-art__center">
                <span>ASCEND</span>

                <strong>
                  Context
                  <br />
                  first.
                </strong>
              </div>

              <div className="public-product-art__caption">
                <span>Brand</span>
                <i />
                <span>Product</span>
                <i />
                <span>Direction</span>
              </div>
            </div>

            <div className="public-product-section__floating">
              <span>Context intelligence</span>
              <strong>4 sources connected</strong>
            </div>
          </div>

          <div className="public-product-section__copy">
            <span className="public-section-number">
              04 / GENERATION CONTEXT
            </span>

            <h2>Cada generación recibe más que un prompt.</h2>

            <p>
              Antes de llegar al modelo, Ascend organiza varias fuentes de
              información con responsabilidades distintas.
            </p>

            <div className="public-context-list">
              {[
                [
                  "01",
                  "Sistema de marca",
                  "Identidad, voz, colores, tipografía y reglas.",
                ],
                [
                  "02",
                  "Inteligencia estratégica",
                  "Persona, pain point, angle, emotion y visual direction.",
                ],
                [
                  "03",
                  "Producto y assets",
                  "Información comercial, imágenes y referencias.",
                ],
                [
                  "04",
                  "Dirección creativa",
                  "Template, estructura, reglas y ejemplos visuales.",
                ],
              ].map(([number, title, description]) => (
                <div key={number}>
                  <span>{number}</span>

                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TWO WORKFLOWS */}
        <section className="public-paths-section">
          <header className="public-section-heading">
            <div>
              <span>05 / DOS FORMAS DE PRODUCIR</span>
              <h2>
                Elige cuánto quieres
                <br />
                controlar.
              </h2>
            </div>

            <p>
              Ambos caminos convergen en GenerationJobs revisables. Lo que
              cambia es cuánto trabajo quieres realizar manualmente antes de
              llegar allí.
            </p>
          </header>

          <div className="public-paths-grid">
            <WorkflowChoice
              type="manual"
              label="A / CONTROL DIRECTO"
              title="Campaign Workspace"
              description="Para piezas donde cada detalle importa. Construye la campaña y sus jobs directamente dentro del estudio."
              href="/workspace"
              action="Explorar flujo manual"
              items={[
                "Audiencia manual cuando corresponda",
                "Recursos específicos por proyecto",
                "Configuración individual por GenerationJob",
                "Revisión antes del dispatch",
              ]}
            />

            <WorkflowChoice
              type="planner"
              label="B / PLANIFICACIÓN ASISTIDA"
              title="Concept Planner"
              description="Para explorar o escalar. Combina perfiles y templates para diseñar múltiples conceptos antes de producir."
              href="/concept-planner"
              action="Explorar Concept Planner"
              items={[
                "Brand Intelligence Profiles",
                "Múltiples AdTemplates",
                "Conceptos y copy planificados",
                "Expansión a GenerationBatch",
              ]}
            />
          </div>
        </section>

        {/* PIPELINE */}
        <section className="public-pipeline">
          <div className="public-pipeline__ambient" />

          <header>
            <div>
              <span>06 / PRODUCTION PIPELINE</span>

              <h2>
                IA bajo control.
                <br />
                De principio a fin.
              </h2>
            </div>

            <p>
              Ascend conserva el contexto que produjo cada resultado y mantiene
              separadas planificación, revisión y ejecución.
            </p>
          </header>

          <div className="public-pipeline__track">
            {pipeline.map((item, index) => (
              <article key={item.number}>
                <div className="public-pipeline__node">
                  <span>{item.number}</span>
                </div>

                {index < pipeline.length - 1 ? <i /> : null}

                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="public-pipeline__footer">
            <div>
              <span>TRACEABILITY</span>

              <strong>Project · Job · Prompt · Model · Result</strong>
            </div>

            <div>
              <span>HUMAN CONTROL</span>

              <strong>Review before dispatch</strong>
            </div>
          </div>
        </section>

        {/* MEMORY */}
        <section className="public-memory">
          <div className="public-memory__copy">
            <span>07 / CREATIVE MEMORY</span>

            <h2>Cada campaña deja algo útil para la siguiente.</h2>

            <p>
              Ascend no trata cada generación como un evento aislado. El
              workspace conserva las fuentes, decisiones y resultados que
              construyen tu sistema.
            </p>

            <div className="public-memory__metrics">
              <div>
                <strong>01</strong>
                <span>Una fuente de marca</span>
              </div>

              <div>
                <strong>∞</strong>
                <span>Campañas reutilizando contexto</span>
              </div>
            </div>
          </div>

          <div className="public-memory__visual">
            <div className="public-memory__orbit public-memory__orbit--outer" />
            <div className="public-memory__orbit public-memory__orbit--middle" />
            <div className="public-memory__orbit public-memory__orbit--inner" />

            <div className="public-memory__center">
              <span>ASCEND</span>
              <strong>Context</strong>
              <small>Workspace memory</small>
            </div>

            <span className="public-memory__satellite public-memory__satellite--one">
              Brand
            </span>

            <span className="public-memory__satellite public-memory__satellite--two">
              Product
            </span>

            <span className="public-memory__satellite public-memory__satellite--three">
              Profiles
            </span>

            <span className="public-memory__satellite public-memory__satellite--four">
              Templates
            </span>
          </div>
        </section>

        {/* CTA */}
        <section className="public-final-cta">
          <div className="public-final-cta__ambient" />

          <div className="public-final-cta__index">
            <span>ASCEND / START</span>
            <i />
          </div>

          <div className="public-final-cta__copy">
            <h2>
              Configura los fundamentos.
              <br />
              Después, concéntrate en crear.
            </h2>

            <p>
              Construye un workspace donde marca, estrategia, catálogo y
              producción creativa funcionen como un único sistema.
            </p>
          </div>

          <div className="public-final-cta__actions">
            {authenticated ? (
              <Link
                className="btn btn-primary public-primary-action"
                href="/dashboard"
              >
                Continuar en Ascend
                <ArrowIcon />
              </Link>
            ) : sessionStatus === "anonymous" ? (
              <>
                <Link
                  className="btn btn-primary public-primary-action"
                  href="/register"
                >
                  Crear mi estudio
                  <ArrowIcon />
                </Link>

                <Link className="public-secondary-action" href="/login">
                  Ingresar
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <footer className="public-home-footer">
          <span>ASCEND</span>

          <p>Creative intelligence · Context first · Human controlled</p>

          <small>2026</small>
        </footer>
      </main>
    </>
  );
}

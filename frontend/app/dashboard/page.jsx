"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Nav from "@/components/Nav";
import { api, ensureWorkspace } from "@/lib/api";

const ONBOARDING_STORAGE_KEY = "ascend-dashboard-onboarding-dismissed-v2";

const setupSteps = [
  {
    number: "01",
    eyebrow: "Una vez",
    title: "Define tu Brand Kit",
    description:
      "Registra identidad, voz y reglas. Ascend podrá reutilizarlas en proyectos futuros sin pedirte que reconstruyas la marca.",
    href: "/brand-kit",
    action: "Configurar Brand Kit",
    icon: "brand",
    reusable: true,
  },
  {
    number: "02",
    eyebrow: "Reutilizable",
    title: "Construye Brand Intelligence",
    description:
      "Convierte investigación en perfiles estratégicos con persona, pain point, angle, emotion, visual direction y copy hook.",
    href: "/brand-intelligence",
    action: "Crear perfiles",
    icon: "intelligence",
    reusable: true,
  },
  {
    number: "03",
    eyebrow: "Reutilizable",
    title: "Carga productos y referencias",
    description:
      "Tu catálogo y biblioteca visual permanecen disponibles para diferentes campañas.",
    href: "/products",
    secondaryHref: "/references",
    action: "Ver productos",
    secondaryAction: "Ver referencias",
    icon: "resources",
    reusable: true,
  },
  {
    number: "04",
    eyebrow: "Reutilizable",
    title: "Prepara dirección creativa",
    description:
      "Crea templates, ejemplos y reglas visuales que después podrás aplicar a múltiples conceptos.",
    href: "/recipes",
    action: "Dirección creativa",
    icon: "direction",
    reusable: true,
  },
  {
    number: "05",
    eyebrow: "Por campaña",
    title: "Crea el proyecto",
    description:
      "Aquí defines aquello que sí cambia: objetivo, oferta, mensaje, recursos específicos y contexto de la campaña.",
    href: "/workspace",
    action: "Crear contenido",
    icon: "project",
    reusable: false,
  },
  {
    number: "06",
    eyebrow: "Por campaña",
    title: "Produce manualmente o planifica",
    description:
      "Usa Campaign Workspace para control directo o Concept Planner para combinar perfiles y templates y preparar varios jobs.",
    href: "/workspace",
    secondaryHref: "/concept-planner",
    action: "Workspace manual",
    secondaryAction: "Concept Planner",
    icon: "concept",
    reusable: false,
  },
];

const workflowCards = [
  {
    id: "manual",
    index: "A",
    eyebrow: "Una pieza o control fino",
    title: "Campaign Workspace",
    description:
      "Construye y ajusta GenerationJobs directamente cuando necesitas controlar cada decisión de una pieza.",
    href: "/workspace",
    action: "Crear manualmente",
    tone: "copper",
    points: [
      "Audiencia manual cuando no existe profile_used",
      "Selección específica de recursos",
      "Control de modelo, outputs y prompts",
      "Dispatch cuando tú lo decidas",
    ],
  },
  {
    id: "planner",
    index: "B",
    eyebrow: "Varias piezas o exploración",
    title: "Concept Planner",
    description:
      "Combina información que ya preparaste para construir conceptos y convertirlos en GenerationJobs revisables.",
    href: "/concept-planner",
    action: "Planificar con IA",
    tone: "lavender",
    points: [
      "Reutiliza Brand Intelligence",
      "Combina múltiples AdTemplates",
      "Distribuye conceptos y volumen",
      "No hace dispatch automáticamente",
    ],
  },
];

function toCollection(payload) {
  if (!payload) return [];
  return payload.results || payload;
}

function projectFormat(project) {
  return (
    project?.template_name ||
    project?.parameters?.format ||
    project?.aspect_ratio ||
    project?.content_type ||
    "Brief creativo"
  );
}

function projectVariationCount(project) {
  return (
    project?.jobs?.reduce(
      (sum, job) => sum + Number(job.number_of_outputs || 0),
      0,
    ) ||
    project?.jobs?.length ||
    project?.requested_variations ||
    1
  );
}

function statusLabel(status) {
  const labels = {
    draft: "Borrador",
    queued: "En cola",
    generating: "Generando",
    completed: "Completado",
    failed: "Con error",
  };

  return labels[status] || status || "Sin estado";
}

function Icon({ name }) {
  const paths = {
    brand: (
      <>
        <path d="M12 3 4.5 7v5c0 4.4 3.1 7.4 7.5 9 4.4-1.6 7.5-4.6 7.5-9V7L12 3Z" />
        <path d="m8.7 12 2.1 2.1 4.7-5" />
      </>
    ),

    intelligence: (
      <>
        <path d="M4 12h3l2-6 4 12 2-6h5" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="20" cy="12" r="1" />
      </>
    ),

    resources: (
      <>
        <rect x="3" y="4" width="8" height="8" rx="2" />
        <rect x="13" y="4" width="8" height="8" rx="2" />
        <rect x="8" y="14" width="8" height="7" rx="2" />
      </>
    ),

    direction: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3.5V6M20.5 12H18M12 18v2.5M6 12H3.5" />
      </>
    ),

    create: (
      <>
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),

    review: (
      <>
        <path d="M4 5.5h16v13H4z" />
        <path d="M8 9h8M8 13h5" />
        <path d="m15.5 16 1.5 1.5 3-3" />
      </>
    ),

    project: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M7 8h10M7 12h6M7 16h8" />
      </>
    ),

    concept: (
      <>
        <circle cx="6" cy="7" r="2.2" />
        <circle cx="18" cy="7" r="2.2" />
        <circle cx="12" cy="18" r="2.2" />
        <path d="m7.8 8.3 3 7M16.2 8.3l-3 7M8.2 7h7.6" />
      </>
    ),

    guide: (
      <>
        <path d="M5 4.5h10a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
        <path d="M7 16h10M9 8h5M9 11h4" />
      </>
    ),

    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,

    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      className="home-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function ReadinessItem({
  label,
  value,
  description,
  href,
  persistentLabel = "Reutilizable",
}) {
  const ready = typeof value === "number" && value > 0;

  return (
    <Link
      href={href}
      className={`home-readiness-item ${ready ? "is-ready" : ""}`}
    >
      <span className="home-readiness-item__state">
        {value === null ? "…" : ready ? "✓" : "○"}
      </span>

      <div>
        <span>{persistentLabel}</span>

        <strong>{label}</strong>

        <small>
          {value === null
            ? "Comprobando…"
            : ready
              ? `${value} ${
                  value === 1 ? "elemento disponible" : "elementos disponibles"
                } · ${description}`
              : description}
        </small>
      </div>

      <span className="home-readiness-item__arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function SetupStep({ step }) {
  return (
    <article className="home-onboarding-step">
      <header>
        <span className="home-onboarding-step__number">{step.number}</span>

        <span className="home-onboarding-step__icon">
          <Icon name={step.icon} />
        </span>
      </header>

      <div className="home-onboarding-step__copy">
        <span
          className={`home-kicker ${
            step.reusable ? "home-kicker--persistent" : ""
          }`}
        >
          {step.eyebrow}
        </span>

        <h3>{step.title}</h3>
        <p>{step.description}</p>
      </div>

      <footer>
        <Link href={step.href}>
          {step.action}
          <Icon name="arrow" />
        </Link>

        {step.secondaryHref ? (
          <Link className="secondary" href={step.secondaryHref}>
            {step.secondaryAction}
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

function WorkflowCard({ workflow }) {
  return (
    <Link
      href={workflow.href}
      className={`home-workflow-card home-workflow-card--${workflow.tone}`}
    >
      <header>
        <span>{workflow.index}</span>

        <div>
          <small>{workflow.eyebrow}</small>
          <h3>{workflow.title}</h3>
        </div>
      </header>

      <p>{workflow.description}</p>

      <ul>
        {workflow.points.map((point) => (
          <li key={point}>
            <i />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <footer>
        <strong>{workflow.action}</strong>

        <Icon name="arrow" />
      </footer>
    </Link>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);

  const [support, setSupport] = useState({
    profiles: null,
    templates: null,
    products: null,
    references: null,
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [guideOpen, setGuideOpen] = useState(true);
  const [guideReady, setGuideReady] = useState(false);

  useEffect(() => {
    const dismissed =
      window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";

    setGuideOpen(!dismissed);
    setGuideReady(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await ensureWorkspace();

        const projectData = await api("/studio/projects/");

        setProjects(toCollection(projectData));

        const resources = await Promise.allSettled([
          api("/studio/brand-intelligence/"),
          api("/studio/ad-templates/"),
          api("/studio/products/"),
          api("/studio/creative-references/"),
        ]);

        const count = (result) =>
          result.status === "fulfilled" ? toCollection(result.value).length : 0;

        setSupport({
          profiles: count(resources[0]),
          templates: count(resources[1]),
          products: count(resources[2]),
          references: count(resources[3]),
        });
      } catch (requestError) {
        setError(requestError.message);

        if (requestError.message.toLowerCase().includes("sesión")) {
          window.location.href = "/login";
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const assets = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.jobs || []).flatMap((job) => job.assets || []),
      ),
    [projects],
  );

  const recent = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at),
        )
        .slice(0, 5),
    [projects],
  );

  const featured = recent[0];

  const readiness = useMemo(() => {
    const values = [
      support.profiles,
      support.templates,
      support.products,
      support.references,
    ];

    const loaded = values.every((value) => value !== null);

    if (!loaded) {
      return {
        completed: null,
        total: 4,
        percentage: 0,
      };
    }

    const completed = values.filter((value) => value > 0).length;

    return {
      completed,
      total: 4,
      percentage: Math.round((completed / 4) * 100),
    };
  }, [support]);

  function dismissGuide() {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");

    setGuideOpen(false);
  }

  function reopenGuide() {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);

    setGuideOpen(true);

    window.setTimeout(() => {
      document.getElementById("ascend-onboarding")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 20);
  }

  return (
    <>
      <Nav privateNav />

      <main className="container ascend-home">
        <header className="home-hero">
          <div className="home-hero__copy">
            <div className="eyebrow">Ascend Creative Studio</div>

            <h1>
              Tu sistema está listo
              <br />
              para volver a crear.
            </h1>

            <p>
              Reutiliza el contexto que ya construiste y concéntrate solamente
              en aquello que cambia entre una campaña y la siguiente.
            </p>

            <div className="home-hero__actions">
              <Link className="btn btn-primary" href="/workspace">
                Crear contenido
                <Icon name="arrow" />
              </Link>

              <Link className="btn btn-secondary" href="/concept-planner">
                <Icon name="concept" />
                Concept Planner
              </Link>

              {!guideOpen && guideReady ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={reopenGuide}
                >
                  <Icon name="guide" />
                  Ver guía
                </button>
              ) : null}
            </div>

            <div className="home-hero__microcopy">
              <span>
                <i />
                Contexto reutilizable
              </span>

              <span>
                <i />
                Dos flujos de producción
              </span>

              <span>
                <i />
                Revisión antes del dispatch
              </span>
            </div>
          </div>

          <aside className="home-command-card">
            <header>
              <span>Preparación del sistema</span>

              <span className={`home-live-dot ${loading ? "is-loading" : ""}`}>
                <i />

                {loading ? "Sincronizando" : "Workspace activo"}
              </span>
            </header>

            <div className="home-readiness">
              <div
                className="home-readiness__dial"
                style={{
                  "--home-readiness-angle": `${readiness.percentage * 3.6}deg`,
                }}
              >
                <div>
                  <strong>
                    {readiness.completed === null
                      ? "—"
                      : `${readiness.percentage}%`}
                  </strong>

                  <span>preparado</span>
                </div>
              </div>

              <div className="home-readiness__copy">
                <small>Contexto reutilizable</small>

                <strong>
                  {readiness.completed === null
                    ? "Revisando tu espacio"
                    : readiness.completed === readiness.total
                      ? "Sistema preparado"
                      : `${readiness.completed} de ${readiness.total} pilares listos`}
                </strong>

                <p>
                  Estos recursos permanecen en el workspace y pueden
                  reutilizarse en nuevas campañas.
                </p>
              </div>
            </div>

            <div className="home-command-metrics">
              <div>
                <span>Proyectos</span>
                <strong>{projects.length}</strong>
              </div>

              <div>
                <span>Perfiles</span>
                <strong>{support.profiles ?? "—"}</strong>
              </div>

              <div>
                <span>Templates</span>
                <strong>{support.templates ?? "—"}</strong>
              </div>
            </div>
          </aside>
        </header>

        {error ? (
          <div className="notice error" role="alert">
            {error}
          </div>
        ) : null}

        {guideReady && guideOpen ? (
          <section id="ascend-onboarding" className="home-onboarding">
            <header className="home-onboarding__header">
              <div>
                <div className="eyebrow">Tu guía de inicio</div>

                <h2>Primero construyes el sistema. Después lo reutilizas.</h2>

                <p>
                  Los primeros cuatro pasos crean contexto persistente. Los
                  últimos dos representan el trabajo que repetirás campaña por
                  campaña.
                </p>
              </div>

              <button
                type="button"
                className="home-guide-dismiss"
                onClick={dismissGuide}
              >
                <Icon name="close" />
                Ocultar guía
              </button>
            </header>

            <div className="home-onboarding-principle">
              <div>
                <span>CONFIGURACIÓN</span>

                <strong>Una vez</strong>

                <small>Brand · Intelligence · Products · Direction</small>
              </div>

              <b>→</b>

              <div>
                <span>PRODUCCIÓN</span>

                <strong>Muchas veces</strong>

                <small>Project · Jobs · Results</small>
              </div>
            </div>

            <div className="home-onboarding-path">
              {setupSteps.map((step) => (
                <SetupStep key={step.number} step={step} />
              ))}
            </div>

            <div className="home-onboarding-note">
              <span>Concept Planner</span>

              <p>
                Cuando ya tienes perfiles y templates, puedes combinarlos para
                construir varios conceptos.{" "}
                <strong>
                  Expand crea los GenerationJobs; tú sigues decidiendo cuándo
                  hacer dispatch.
                </strong>
              </p>
            </div>
          </section>
        ) : null}

        <section className="home-section">
          <header className="home-section__header">
            <div>
              <div className="eyebrow">Contexto persistente</div>

              <h2>Lo que ya no necesitas reconstruir.</h2>

              <p>
                Estos elementos viven en tu workspace y alimentan futuros
                proyectos.
              </p>
            </div>
          </header>

          <div className="home-readiness-grid">
            <ReadinessItem
              label="Brand Intelligence"
              value={support.profiles}
              description="perfiles estratégicos disponibles"
              href="/brand-intelligence"
            />

            <ReadinessItem
              label="AdTemplates"
              value={support.templates}
              description="direcciones creativas disponibles"
              href="/recipes"
            />

            <ReadinessItem
              label="Productos"
              value={support.products}
              description="productos reutilizables"
              href="/products"
            />

            <ReadinessItem
              label="Referencias"
              value={support.references}
              description="referencias visuales disponibles"
              href="/references"
            />
          </div>
        </section>

        <section className="home-section home-workflows">
          <header className="home-section__header">
            <div>
              <div className="eyebrow">Crear ahora</div>

              <h2>Elige el flujo según la tarea.</h2>

              <p>
                No existe una única forma de trabajar. Usa control manual para
                decisiones precisas y planificación asistida para escalar
                exploración.
              </p>
            </div>
          </header>

          <div className="home-workflow-grid">
            {workflowCards.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        </section>

        <section className="home-section">
          <header className="home-section__header">
            <div>
              <div className="eyebrow">Continuidad</div>

              <h2>Continúa donde lo dejaste.</h2>

              <p>
                Tus proyectos conservan el contexto y los jobs que los
                originaron.
              </p>
            </div>

            <Link className="btn btn-secondary" href="/projects">
              Ver proyectos
              <Icon name="arrow" />
            </Link>
          </header>

          <div className="home-project-bento">
            <Link
              className="home-featured-project"
              href={featured ? `/projects/${featured.id}` : "/workspace"}
            >
              <div className="home-featured-project__copy">
                <span>
                  {featured ? "Continuar trabajando" : "Tu primer proyecto"}
                </span>

                <h3>{featured?.name || "Crea tu primera campaña"}</h3>

                <p>
                  {featured
                    ? `${projectFormat(featured)} · ${projectVariationCount(
                        featured,
                      )} outputs`
                    : "Tu workspace ya puede empezar a convertir contexto reutilizable en trabajo de generación."}
                </p>

                <strong>
                  {featured ? "Abrir proyecto" : "Empezar ahora"}

                  <Icon name="arrow" />
                </strong>
              </div>

              <div className="home-featured-project__art">
                <span>ASCEND</span>

                <div>
                  <i />
                  <i />
                  <i />
                </div>

                <small>Creative intelligence</small>
              </div>
            </Link>

            <article className="home-mini-metric">
              <span>Proyectos</span>
              <strong>{projects.length}</strong>
              <small>campañas y borradores</small>
              <Icon name="project" />
            </article>

            <article className="home-mini-metric home-mini-metric--warm">
              <span>Contenido</span>
              <strong>{assets.length}</strong>
              <small>outputs registrados</small>
              <Icon name="create" />
            </article>
          </div>
        </section>

        <section className="home-section home-recent">
          <header className="home-section__header">
            <div>
              <div className="eyebrow">Actividad reciente</div>

              <h2>Últimos proyectos</h2>
            </div>
          </header>

          <div className="home-recent-list">
            {recent.map((project, index) => (
              <Link href={`/projects/${project.id}`} key={project.id}>
                <span className="home-recent-index">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="home-recent-copy">
                  <strong>{project.name}</strong>

                  <small>
                    {projectFormat(project)}
                    {" · "}
                    {projectVariationCount(project)}
                    {" outputs"}
                  </small>
                </div>

                <span className={`badge ${project.status || ""}`}>
                  {statusLabel(project.status)}
                </span>

                <time>
                  {project.updated_at
                    ? new Date(project.updated_at).toLocaleDateString("es-PE")
                    : "—"}
                </time>

                <span className="home-recent-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}

            {!recent.length && !loading && !error ? (
              <div className="home-empty-projects">
                <span className="home-empty-projects__mark">
                  <Icon name="create" />
                </span>

                <div>
                  <span className="home-kicker">Todo listo</span>

                  <h3>Crea tu primer proyecto</h3>

                  <p>Puedes empezar manualmente o utilizar Concept Planner.</p>
                </div>

                <div className="home-empty-projects__actions">
                  <Link className="btn btn-primary" href="/workspace">
                    Crear proyecto
                  </Link>

                  <Link className="btn btn-secondary" href="/concept-planner">
                    Concept Planner
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="home-footer-note">
          <span>ASCEND</span>

          <p>
            Configura una vez → reutiliza contexto → decide por campaña → revisa
            → genera.
          </p>
        </footer>
      </main>
    </>
  );
}

import Link from "next/link";

import Nav from "@/components/Nav";
import PageTitle from "@/components/PageTitle";

const steps = [
  [
    "01",
    "/brand-kit",
    "Define tu sistema de marca",
    "Colores, tipografía, logos, tono y reglas que guiarán cada generación.",
    "brand",
  ],
  [
    "02",
    "/products",
    "Construye tu catálogo",
    "Registra productos con información comercial y fotografía de referencia.",
    "product",
  ],
  [
    "03",
    "/recipes",
    "Elige una dirección creativa",
    "Crea recetas y Creative Frames reutilizables para tu equipo.",
    "direction",
  ],
  [
    "04",
    "/workspace",
    "Produce la primera campaña",
    "Completa un brief guiado y genera variantes con trazabilidad total.",
    "create",
  ],
];

export default function Onboarding() {
  return (
    <>
      <Nav privateNav />
      <main className="container onboarding">
        <PageTitle className="onboarding-hero">
          <div className="eyebrow">Puesta a punto</div>
          <h1>Construye los fundamentos de tu estudio.</h1>
          <p>
            Cuatro decisiones breves harán que cada campaña futura sea más
            rápida, precisa y consistente.
          </p>
          <Link className="btn btn-secondary" href="/workspace">
            Omitir configuración
          </Link>
        </PageTitle>
        <section className="onboarding-path">
          {steps.map(([number, href, title, description, type], index) => (
            <Link
              href={href}
              key={number}
              className={`onboarding-step ${type}`}
            >
              <span className="onboarding-number">{number}</span>
              <div className="onboarding-visual">
                <i />
                <i />
              </div>
              <div>
                <small>
                  Paso {index + 1} de {steps.length}
                </small>
                <h2>{title}</h2>
                <p>{description}</p>
                <b>Configurar ahora →</b>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}

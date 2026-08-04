"use client";

import Link from 'next/link';

import Nav from '@/components/Nav';
import { usePublicSessionRedirect } from '@/hooks/usePublicSessionRedirect';

const capabilities = [
  ['01', 'Dirección, no plantillas', 'Recetas creativas que convierten una intención comercial en decisiones visuales precisas.'],
  ['02', 'Marca como sistema', 'Productos, recursos, tipografía y reglas viven en una sola fuente de verdad.'],
  ['03', 'IA bajo control', 'Cada resultado conserva el modelo, el prompt, el proyecto y su contexto de producción.'],
];

const workflow = [
  ['01', 'Define el contexto', 'Conecta marca, producto, audiencia, referencias y objetivo en un brief estructurado.'],
  ['02', 'Dirige la generación', 'Ascend transforma los datos en una instrucción creativa detallada y verificable.'],
  ['03', 'Construye memoria', 'Compara resultados y conserva cada decisión dentro del proyecto que la originó.'],
];

function StudioPreview() {
  return <div className="landing-stage" aria-label="Vista conceptual del estudio Ascend">
    <div className="landing-stage-shell">
      <header className="landing-stage-topbar"><div><i/><i/><i/></div><span>Campaign workspace</span><b>94% match</b></header>
      <div className="landing-stage-body">
        <aside className="landing-stage-assets"><span className="landing-panel-label">Recursos</span><i className="landing-asset-slot"/><i className="landing-asset-slot"/><i className="landing-asset-slot"/><i className="landing-asset-slot"/></aside>
        <div className="landing-stage"><div className="landing-image-placeholder"><span>Ascend / Editorial 01</span><strong>Precisión creativa para cada producto.</strong><small>4:5 · Gemini Image</small></div><div className="landing-stage-focus"><span/>Dirección consistente</div></div>
        <aside className="landing-stage-inspector"><span className="landing-panel-label">Dirección</span><div className="landing-inspector-field"><small>Ángulo</small><strong>Beneficio editorial</strong></div><div className="landing-inspector-field"><small>Atmósfera</small><strong>Cálida · Precisa</strong></div><div className="landing-inspector-field"><small>Formato</small><strong>Social · 4:5</strong></div><div className="landing-inspector-slider"><span/></div><div className="landing-generate-dial"><div><span>Generar</span><small>4 variaciones</small></div></div></aside>
      </div>
    </div>
    <div className="landing-context-card"><span>Contexto activo</span><strong>Marca + producto</strong><small>12 reglas aplicadas</small></div>
    <div className="landing-score-card"><span>Creative score</span><strong>94</strong><small>Dirección consistente</small></div>
  </div>;
}

export default function Home() {
  const sessionStatus = usePublicSessionRedirect({ redirect: false });
  const authenticated = sessionStatus === 'authenticated';

  return <><Nav/><main className="landing-page">
    <section className="landing-hero">
      <div className="landing-hero-mesh"/>
      <div className="landing-copy">
        <div className="landing-kicker"><i className="landing-kicker-line"/>Ascend Creative Intelligence</div>
        <h1>Dirección de arte para cada producto. <span>A escala.</span></h1>
        <p>Un estudio creativo impulsado por IA que transforma el contexto de tu marca en campañas visuales precisas, consistentes y listas para producir.</p>
        <div className="actions">{authenticated ? <Link className="btn landing-primary-action" href="/dashboard">Ir a mi estudio <span>↗</span></Link> : sessionStatus === 'anonymous' ? <><Link className="btn landing-primary-action" href="/register">Abrir mi estudio <span>↗</span></Link><Link className="landing-secondary-action" href="/login">Ya tengo una cuenta</Link></> : null}</div>
        <div className="proof-strip"><span><i/>Briefs estructurados</span><span><i/>Marca consistente</span><span><i/>Generación trazable</span></div>
      </div>
      <StudioPreview/>
    </section>

    <section className="landing-statement"><div><span className="landing-section-number">01 — PRINCIPIO</span><h2>La interfaz desaparece. La campaña destaca.</h2></div><p>Ascend se comporta como un estudio de dirección de arte: organiza el contexto, reduce decisiones repetitivas y deja visible únicamente lo necesario para producir mejor.</p></section>

    <section className="card" aria-label="Capacidades de Ascend">{capabilities.map(([number, title, description]) => <article key={number}><span>{number}</span><div className="landing-capability-line"/><h3>{title}</h3><p>{description}</p></article>)}</section>

    <section className="landing-product-story"><div className="landing-product-visual"><div className="product-story-placeholder"><span>PRODUCT / 08</span><strong>Un catálogo que entiende cómo debe presentarse.</strong></div><div className="landing-visual-caption"><span>Context intelligence</span><strong>Producto conectado a su marca</strong></div></div><div className="landing-product-copy"><span className="landing-section-number">02 — CONTEXTO</span><h2>Tu producto nunca parte de una página en blanco.</h2><p>La plataforma reúne información comercial, visual y estratégica antes de pedirle una imagen a la IA.</p><dl className="landing-data-list"><div><dt>01</dt><dd><strong>Sistema de marca</strong><span>Voz, tipografía, color y reglas creativas.</span></dd></div><div><dt>02</dt><dd><strong>Catálogo de producto</strong><span>Atributos, beneficios, oferta e imagen principal.</span></dd></div><div><dt>03</dt><dd><strong>Referencias curatoriales</strong><span>Estilo, composición, luz, color y atmósfera.</span></dd></div></dl></div></section>

    <section className="landing-workflow"><header><div><span className="landing-section-number">03 — FLUJO</span><h2>De intención comercial a dirección visual.</h2></div><p>Un proceso compacto que conserva el criterio humano y hace que la inteligencia artificial trabaje con información útil.</p></header><div className="landing-workflow-grid">{workflow.map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>

    <section className="landing-studio-feature"><div className="landing-studio-copy"><span className="landing-section-number">04 — STUDIO SYSTEM</span><h2>Una operación creativa que conserva su memoria.</h2><p>Proyectos, prompts, recursos, modelos y resultados permanecen conectados. Nada importante se pierde entre una generación y la siguiente.</p><ul><li>Prompts completos y auditables</li><li>Resultados organizados por trabajo de generación</li><li>Recursos y referencias reutilizables</li></ul><Link className="landing-inline-link" href={authenticated ? '/dashboard' : '/register'}>{authenticated ? 'Volver al estudio' : 'Construir mi sistema'} <span>→</span></Link></div><div className="landing-interface-visual"><div className="interface-placeholder"><span>PROJECT / ACTIVE</span><strong>Campaign intelligence</strong><small>Brand · Product · References · Prompt</small></div></div></section>

    <section className="landing-final-cta"><div className="landing-final-orbit"/><div><span className="landing-section-number">ASCEND / START</span><h2>Construye más. Coordina menos.</h2><p>Crea un espacio donde marca, catálogo y dirección creativa trabajen como un solo sistema.</p></div><div className="landing-final-actions">{authenticated ? <Link className="btn landing-primary-action" href="/dashboard">Continuar en Ascend <span>↗</span></Link> : sessionStatus === 'anonymous' ? <><Link className="btn landing-primary-action" href="/register">Crear mi estudio <span>↗</span></Link><Link className="landing-text-link" href="/login">Ingresar a mi cuenta <span>→</span></Link></> : null}</div></section>
  </main></>;
}

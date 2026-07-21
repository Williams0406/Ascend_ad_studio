'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import Nav from '@/components/Nav';
import { api, ensureWorkspace } from '@/lib/api';

const formats = [
  ['flyer', 'Flyer editorial', 'Oferta y producto en una composición directa.', '4:5'],
  ['story', 'Story inmersiva', 'Narrativa vertical creada para atención móvil.', '9:16'],
  ['banner', 'Banner de campaña', 'Mensaje preciso para e-commerce y pauta.', '16:9'],
];

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [credits, setCredits] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        await ensureWorkspace();
        const [projectData, creditData] = await Promise.all([api('/studio/projects/'), api('/billing/credits/')]);
        setProjects(projectData.results || projectData);
        setCredits(creditData);
      } catch (requestError) {
        setError(requestError.message);
        if (requestError.message.includes('sesión')) location.href = '/login';
      }
    }
    load();
  }, []);

  const assets = useMemo(() => projects.flatMap(project => (project.jobs || []).flatMap(job => job.assets || [])), [projects]);
  const recent = projects.slice(0, 5);
  const featured = recent[0];

  return <><Nav privateNav/><main className="container ascend-dashboard"><header className="dashboard-hero"><div><div className="eyebrow">Estudio activo</div><h1>¿Qué vamos a crear hoy?</h1><p>Inicia una dirección, continúa una campaña o revisa el trabajo que tu equipo ya produjo.</p><Link className="btn primary" href="/projects/new">Crear contenido <span>→</span></Link></div><div className="dashboard-focus"><span>Créditos disponibles</span><strong>{credits?.available_credits ?? '—'}</strong><small>El costo siempre será visible antes de generar.</small><i/></div></header>{error && <div className="error" role="alert">{error}</div>}<section className="dashboard-bento"><Link className="bento-feature" href={featured ? `/projects/${featured.id}` : '/projects/new'}><div><span>{featured ? 'Continuar trabajando' : 'Tu primer proyecto'}</span><h2>{featured?.name || 'Crea una campaña extraordinaria'}</h2><p>{featured ? `${featured.content_type} · ${featured.aspect_ratio}` : 'Ascend organizará el brief, los activos y cada generación.'}</p></div><div className="bento-art"><i/><i/><i/></div></Link><div className="bento-metric"><span>Proyectos</span><strong>{projects.length}</strong><small>campañas y borradores</small></div><div className="bento-metric warm"><span>Contenido</span><strong>{assets.length}</strong><small>archivos producidos</small></div></section><section className="dashboard-section"><header><div><div className="eyebrow">Punto de partida</div><h2>Crear con intención</h2></div><Link href="/recipes">Explorar dirección creativa →</Link></header><div className="format-grid-premium">{formats.map(([format,title,description,ratio],index)=><Link href={`/projects/new?format=${format}`} key={format}><div className={`format-art art-${index + 1}`}><span>{ratio}</span><i/></div><h3>{title}</h3><p>{description}</p><span className="format-open">Abrir brief →</span></Link>)}</div></section><section className="dashboard-section recent-section"><header><div><div className="eyebrow">Actividad reciente</div><h2>Trabajo del estudio</h2></div><Link href="/projects">Ver todos los proyectos →</Link></header><div className="recent-project-list">{recent.map((project, index)=><Link href={`/projects/${project.id}`} key={project.id}><span className="recent-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{project.name}</strong><small>{project.content_type} · {project.requested_variations} variantes</small></div><i className={`project-state ${project.status}`}>{project.status}</i><time>{new Date(project.updated_at).toLocaleDateString('es-PE')}</time><b>→</b></Link>)}{!recent.length && !error && <div className="dashboard-empty"><span>◎</span><h3>El estudio está listo</h3><p>Crea tu primera campaña para comenzar tu portafolio de trabajo.</p><Link className="btn primary" href="/projects/new">Crear primera campaña</Link></div>}</div></section></main></>;
}

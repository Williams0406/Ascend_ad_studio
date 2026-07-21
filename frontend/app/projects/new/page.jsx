'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import Nav from '@/components/Nav';
import { api, ensureWorkspace } from '@/lib/api';

const CONTENT_TYPES = [['flyer','Flyer'],['social_post','Post social'],['story','Story'],['banner','Banner'],['carousel','Carrusel'],['short_video','Video corto'],['product_video','Video de producto']];
const INPUT_ROLES = [['product_image','Imagen del producto'],['logo','Logo'],['background','Fondo'],['style_reference','Referencia de estilo'],['character_reference','Referencia de personaje'],['packaging','Empaque'],['other','Otro']];
const REFERENCE_PURPOSES = [['style','Estilo'],['composition','Composición'],['lighting','Iluminación'],['color','Color'],['typography','Tipografía'],['pose','Pose'],['mood','Atmósfera']];
const INITIAL_FORM = {name:'',content_type:'flyer',product:'',template:'',recipe:'',creative_angle:'',message_type:'',campaign_theme:'',headline:'',offer_text:'',call_to_action:'Compra ahora',target_audience:'',focus_tags:[],aspect_ratio:'4:5',resolution:'1K',quality_mode:'standard',requested_variations:1,use_brand_kit:true,input_assets:[],references:[]};

const list = data => data?.results || data || [];
const mediaType = type => type === 'carousel' ? 'carousel' : type?.includes('video') ? 'video' : 'image';
const idOf = value => typeof value === 'object' ? value?.id || '' : value || '';
const projectAssets = project => project?.jobs?.flatMap(job => (job.assets || []).map(asset => ({...asset, job}))) || [];

function Tags({value,onChange}) {
  const [draft,setDraft]=useState('');
  function add(){const next=draft.trim();if(next&&!value.includes(next))onChange([...value,next]);setDraft('');}
  return <div className="workbench-tags"><div>{value.map(tag=><button type="button" key={tag} onClick={()=>onChange(value.filter(item=>item!==tag))}>{tag}<b>×</b></button>)}</div><input value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();add();}}} onBlur={add} placeholder="Escribe y presiona Enter"/></div>;
}

function Control({label,children,wide=false}) {
  return <label className={`workbench-control ${wide?'wide':''}`}><span>{label}</span>{children}</label>;
}

function NewProjectContent() {
  const searchParams=useSearchParams();
  const canvasRef=useRef(null);
  const [form,setForm]=useState(INITIAL_FORM);
  const [options,setOptions]=useState({products:[],templates:[],recipes:[],angles:[],assets:[],references:[]});
  const [projects,setProjects]=useState([]);
  const [activeProject,setActiveProject]=useState(null);
  const [selectedImage,setSelectedImage]=useState(null);
  const [browserMode,setBrowserMode]=useState('results');
  const [resourceMode,setResourceMode]=useState('assets');
  const [credits,setCredits]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const compatibleRecipes=useMemo(()=>options.recipes.filter(item=>item.content_type===mediaType(form.content_type)),[options.recipes,form.content_type]);
  const compatibleTemplates=useMemo(()=>options.templates.filter(item=>item.content_type===mediaType(form.content_type)),[options.templates,form.content_type]);
  const generated=useMemo(()=>projectAssets(activeProject),[activeProject]);
  const selectedProduct=options.products.find(item=>String(item.id)===String(form.product));
  const selectedTemplate=options.templates.find(item=>String(item.id)===String(form.template));
  const selectedRecipe=options.recipes.find(item=>String(item.id)===String(form.recipe));
  const cost=(Number(form.requested_variations)||1)*10;
  const availableCredits=credits?.available_credits??0;

  async function load() {
    setLoading(true);
    await ensureWorkspace();
    const [products,templates,recipes,angles,assets,references,projectData,creditData]=await Promise.all([
      api('/studio/products/'),api('/studio/ad-templates/'),api('/studio/recipes/'),api('/studio/creative-angles/'),api('/studio/brand-assets/'),api('/studio/creative-references/'),api('/studio/projects/'),api('/billing/credits/'),
    ]);
    const next={products:list(products),templates:list(templates),recipes:list(recipes),angles:list(angles),assets:list(assets),references:list(references)};
    setOptions(next);setProjects(list(projectData));setCredits(creditData);
    const recipe=next.recipes.find(item=>String(item.id)===String(searchParams.get('recipe')));
    setForm(current=>({...current,...(searchParams.get('product')?{product:searchParams.get('product')}:{}),...(searchParams.get('format')?{content_type:searchParams.get('format')}:{}),...(recipe?{recipe:recipe.id,creative_angle:idOf(recipe.creative_angle),name:recipe.name}:{})}));
    setLoading(false);
  }

  useEffect(()=>{load().catch(requestError=>{setError(requestError.message);setLoading(false);});},[searchParams]);

  function selectRecipe(value) {
    const recipe=options.recipes.find(item=>String(item.id)===String(value));
    setForm(current=>({...current,recipe:value,creative_angle:recipe?idOf(recipe.creative_angle):''}));
  }

  function toggleAsset(asset) {
    const found=form.input_assets.find(item=>String(item.brand_asset)===String(asset.id));
    if(found){update('input_assets',form.input_assets.filter(item=>String(item.brand_asset)!==String(asset.id)));return;}
    const role=asset.category==='logo'?'logo':asset.category==='background'?'background':asset.category==='packaging'?'packaging':asset.category==='product'?'product_image':'other';
    update('input_assets',[...form.input_assets,{brand_asset:asset.id,input_role:role,sort_order:form.input_assets.length}]);
  }
  function updateAsset(id,key,value){update('input_assets',form.input_assets.map(item=>String(item.brand_asset)===String(id)?{...item,[key]:value}:item));}
  function toggleReference(reference){const found=form.references.find(item=>String(item.reference)===String(reference.id));update('references',found?form.references.filter(item=>String(item.reference)!==String(reference.id)):[...form.references,{reference:reference.id,purpose:'style',weight:100}]);}
  function updateReference(id,key,value){update('references',form.references.map(item=>String(item.reference)===String(id)?{...item,[key]:value}:item));}

  function selectGeneratedImage(asset) {
    setSelectedImage(asset);
    requestAnimationFrame(()=>canvasRef.current?.scrollIntoView({behavior:'smooth',block:'center'}));
  }

  async function loadProject(projectSummary) {
    setBusy(true);setError('');setNotice('');
    try {
      const project=await api(`/studio/projects/${projectSummary.id}/`);
    setActiveProject(project);
    const foreignKeys=new Set(['product','template','recipe','creative_angle']);
    const values=Object.fromEntries(Object.keys(INITIAL_FORM).filter(key=>!['input_assets','references'].includes(key)).map(key=>{
      if(key==='focus_tags')return [key,project[key]||[]];
      if(foreignKeys.has(key))return [key,idOf(project[key])];
      return [key,project[key]??INITIAL_FORM[key]];
    }));
    setForm({...INITIAL_FORM,...values,input_assets:(project.input_assets||[]).map((item,index)=>({id:item.id,brand_asset:idOf(item.brand_asset),input_role:item.input_role,sort_order:item.sort_order??index})),references:(project.references||[]).map(item=>({id:item.id,reference:idOf(item.reference),purpose:item.purpose,weight:item.weight}))});
      const images=projectAssets(project);setSelectedImage(images[0]||null);setBrowserMode('results');setProjects(current=>current.map(item=>String(item.id)===String(project.id)?project:item));setNotice(`Proyecto “${project.name}” cargado. Todos sus campos fueron aplicados.`);requestAnimationFrame(()=>canvasRef.current?.scrollIntoView({behavior:'smooth',block:'center'}));
    } catch(requestError) {
      setError(requestError.message||'No se pudo cargar el proyecto seleccionado.');
    } finally {
      setBusy(false);
    }
  }

  function newProject() {
    setActiveProject(null);setSelectedImage(null);setForm(INITIAL_FORM);setError('');setNotice('Nuevo proyecto listo. Define una dirección y genera cuando quieras.');window.scrollTo({top:0,behavior:'smooth'});
  }

  function scalarPayload(){const {input_assets,references,...values}=form;return {...values,product:form.product||null,template:form.template||null,recipe:form.recipe||null,creative_angle:form.creative_angle||null,requested_variations:Number(form.requested_variations)||1};}
  function nestedPayload(){return {...scalarPayload(),input_assets:form.input_assets.map((item,index)=>({brand_asset:item.brand_asset,input_role:item.input_role,sort_order:Number(item.sort_order??index)})),references:form.references.map(item=>({reference:item.reference,purpose:item.purpose,weight:Number(item.weight)||100}))};}

  async function syncRelations(project) {
    const oldAssets=project.input_assets||[];const oldRefs=project.references||[];
    const assetSignature=items=>JSON.stringify(items.map(item=>[String(idOf(item.brand_asset)),item.input_role,Number(item.sort_order||0)]).sort());
    const refSignature=items=>JSON.stringify(items.map(item=>[String(idOf(item.reference)),item.purpose,Number(item.weight||100)]).sort());
    if(assetSignature(oldAssets)!==assetSignature(form.input_assets)){
      await Promise.all(oldAssets.map(item=>api(`/studio/projects/${project.id}/input-assets/${item.id}/`,{method:'DELETE'})));
      for(const item of form.input_assets)await api(`/studio/projects/${project.id}/input-assets/`,{method:'POST',body:JSON.stringify({brand_asset:item.brand_asset,input_role:item.input_role,sort_order:Number(item.sort_order||0)})});
    }
    if(refSignature(oldRefs)!==refSignature(form.references)){
      await Promise.all(oldRefs.map(item=>api(`/studio/projects/${project.id}/references/${item.id}/`,{method:'DELETE'})));
      for(const item of form.references)await api(`/studio/projects/${project.id}/references/`,{method:'POST',body:JSON.stringify({reference:item.reference,purpose:item.purpose,weight:Number(item.weight)||100})});
    }
  }

  async function generate() {
    if(!form.name.trim()){setError('Asigna un nombre al proyecto antes de generar.');return;}
    if(availableCredits<cost){setError(`Necesitas ${cost} créditos y tienes ${availableCredits}.`);return;}
    setBusy(true);setError('');setNotice('');
    try{
      let project;
      if(activeProject){await api(`/studio/projects/${activeProject.id}/`,{method:'PATCH',body:JSON.stringify(scalarPayload())});await syncRelations(activeProject);project=await api(`/studio/projects/${activeProject.id}/`);}
      else project=await api('/studio/projects/',{method:'POST',body:JSON.stringify(nestedPayload())});
      await api(`/studio/projects/${project.id}/generate/`,{method:'POST',body:JSON.stringify({number_of_outputs:Number(form.requested_variations)||1,provider:'auto'})});
      const refreshed=await api(`/studio/projects/${project.id}/`);const projectList=list(await api('/studio/projects/'));setActiveProject(refreshed);setProjects(projectList);const images=projectAssets(refreshed);setSelectedImage(images[0]||null);setBrowserMode('results');setCredits(current=>current?{...current,available_credits:Math.max(0,(current.available_credits||0)-cost)}:current);setNotice('Generación completada. Selecciona una imagen para verla en el lienzo.');
    }catch(requestError){setError(requestError.message);}finally{setBusy(false);}
  }

  if(loading)return <><Nav privateNav/><main className="container creative-workbench-loading"><i/><span>Preparando el estudio creativo…</span></main></>;

  return <><Nav privateNav/><main className="container creative-workbench">
    <header className="workbench-topbar"><div><span>Ascend Creative Intelligence</span><strong>{activeProject?'Proyecto activo':'Nuevo proyecto'}</strong></div><div className="workbench-topbar__status"><i/>{activeProject?.name||form.name||'Sin nombre'}</div><div><span>Créditos</span><strong>{availableCredits}</strong></div><Link href="/projects">Salir</Link></header>
    {(error||notice)&&<div className={`workbench-notice ${error?'error':''}`} role={error?'alert':'status'}><span>{error||notice}</span><button onClick={()=>{setError('');setNotice('');}}>×</button></div>}
    <section className="workbench-studio">
      <aside className="workbench-panel workbench-panel--left"><header><span>01 / Contexto</span><h2>Fuentes</h2><p>Define qué debe interpretar la IA.</p></header><div className="workbench-panel__scroll">
        <Control label="Producto"><select className="input" value={form.product} onChange={event=>update('product',event.target.value)}><option value="">Campaña sin producto</option>{options.products.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Control>
        {selectedProduct&&<div className="workbench-selection-summary">{selectedProduct.main_image_url&&<img src={selectedProduct.main_image_url} alt=""/>}<div><span>Producto activo</span><strong>{selectedProduct.name}</strong><small>{selectedProduct.category||'Catálogo'}</small></div></div>}
        <Control label="Template"><select className="input" value={form.template} onChange={event=>update('template',event.target.value)}><option value="">Composición libre</option>{compatibleTemplates.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Control>
        {selectedTemplate&&<div className="workbench-selection-summary compact">{selectedTemplate.source_asset_url&&<img src={selectedTemplate.source_asset_url} alt=""/>}<div><span>Frame activo</span><strong>{selectedTemplate.name}</strong></div></div>}
        <label className="workbench-brand-switch"><div><span>Brand Kit</span><small>Aplicar colores, voz y restricciones.</small></div><input type="checkbox" checked={form.use_brand_kit} onChange={event=>update('use_brand_kit',event.target.checked)}/><i/></label>
        <div className="workbench-resource-tabs"><button className={resourceMode==='assets'?'active':''} onClick={()=>setResourceMode('assets')}>ProjectInputAsset <b>{form.input_assets.length}</b></button><button className={resourceMode==='references'?'active':''} onClick={()=>setResourceMode('references')}>ProjectReference <b>{form.references.length}</b></button></div>
        {resourceMode==='assets'?<div className="workbench-resource-grid">{options.assets.map(asset=>{const entry=form.input_assets.find(item=>String(item.brand_asset)===String(asset.id));return <article className={entry?'active':''} key={asset.id}><button type="button" onClick={()=>toggleAsset(asset)}>{asset.file_url?<img src={asset.file_url} alt={asset.name}/>:<span>{asset.name?.[0]}</span>}<i>{entry?'✓':'+'}</i></button><strong>{asset.name}</strong>{entry&&<select value={entry.input_role} onChange={event=>updateAsset(asset.id,'input_role',event.target.value)}>{INPUT_ROLES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</article>})}</div>:<div className="workbench-resource-grid">{options.references.map(reference=>{const entry=form.references.find(item=>String(item.reference)===String(reference.id));return <article className={entry?'active':''} key={reference.id}><button type="button" onClick={()=>toggleReference(reference)}><img src={reference.image_url} alt={reference.title}/><i>{entry?'✓':'+'}</i></button><strong>{reference.title}</strong>{entry&&<><select value={entry.purpose} onChange={event=>updateReference(reference.id,'purpose',event.target.value)}>{REFERENCE_PURPOSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label>Peso {entry.weight}%<input type="range" min="1" max="100" value={entry.weight} onChange={event=>updateReference(reference.id,'weight',event.target.value)}/></label></>}</article>})}</div>}
      </div></aside>

      <section className="workbench-center" ref={canvasRef}><header><div><span>02 / Canvas</span><strong>{selectedImage?'Resultado seleccionado':'Dirección en construcción'}</strong></div><div>{form.aspect_ratio} · {form.resolution}</div></header><div className="workbench-canvas">{selectedImage?.file_url?<img key={selectedImage.id} src={selectedImage.file_url} alt="Resultado generado seleccionado"/>:<div className="workbench-canvas-empty"><i/><span>Creative canvas</span><h2>{form.headline||'Tu próxima campaña empieza aquí.'}</h2><p>{form.offer_text||'Completa la dirección y genera para visualizar el primer resultado.'}</p><small>{selectedProduct?.name||'Brand campaign'} · {selectedRecipe?.name||'Dirección libre'}</small></div>}</div>
        <section className="workbench-browser"><header><div><button className={browserMode==='results'?'active':''} onClick={()=>setBrowserMode('results')}>Resultados <b>{generated.length}</b></button><button className={browserMode==='projects'?'active':''} onClick={()=>setBrowserMode('projects')}>Proyectos <b>{projects.length}</b></button></div><span>{browserMode==='results'?'Selecciona una imagen para llevarla al canvas.':'Desplázate con la barra y selecciona un proyecto.'}</span></header>{browserMode==='results'?<div className="workbench-result-strip">{generated.map(asset=><button type="button" key={asset.id} className={selectedImage?.id===asset.id?'active':''} onClick={()=>selectGeneratedImage(asset)}>{asset.file_url?<img src={asset.file_url} alt="Resultado generado"/>:<span>Archivo</span>}<small>{asset.job?.model_name||'Generado'}</small></button>)}{!generated.length&&<div className="workbench-browser-empty">Las imágenes generadas aparecerán aquí.</div>}</div>:<div className="workbench-project-strip"><button type="button" className="workbench-new-project" onClick={newProject} aria-label="Crear un proyecto nuevo"><span>+</span><strong>Nuevo proyecto</strong><i>Brief en blanco</i></button>{projects.map(project=><button type="button" key={project.id} className={activeProject?.id===project.id?'active':''} onClick={()=>loadProject(project)} disabled={busy}><div>{projectAssets(project)[0]?.file_url?<img src={projectAssets(project)[0].file_url} alt=""/>:<span>{project.name?.slice(0,2).toUpperCase()}</span>}</div><small>{project.content_type}</small><strong>{project.name}</strong><i>{projectAssets(project).length} resultados</i></button>)}</div>}</section>
      </section>

      <aside className="workbench-panel workbench-panel--right"><header><span>03 / Dirección</span><h2>Brief</h2><p>Completa los campos en cualquier orden.</p></header><div className="workbench-panel__scroll workbench-form">
        <Control label="Recipe"><select className="input" value={form.recipe} onChange={event=>selectRecipe(event.target.value)}><option value="">Dirección libre</option>{compatibleRecipes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Control>
        <Control label="Creative angle"><select className="input" value={form.creative_angle} onChange={event=>update('creative_angle',event.target.value)}><option value="">Sin ángulo</option>{options.angles.filter(item=>item.is_active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Control>
        <Control label="Nombre"><input className="input" value={form.name} onChange={event=>update('name',event.target.value)} placeholder="Nombre interno del proyecto"/></Control>
        <div className="workbench-form__two"><Control label="Content type"><select className="input" value={form.content_type} onChange={event=>setForm(current=>({...current,content_type:event.target.value,recipe:'',creative_angle:'',template:''}))}>{CONTENT_TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Control><Control label="Message type"><input className="input" value={form.message_type} onChange={event=>update('message_type',event.target.value)} placeholder="Lanzamiento"/></Control></div>
        <Control label="Campaign theme"><input className="input" value={form.campaign_theme} onChange={event=>update('campaign_theme',event.target.value)} placeholder="Concepto de campaña"/></Control>
        <Control label="Headline"><textarea className="input workbench-headline" value={form.headline} onChange={event=>update('headline',event.target.value)} placeholder="La idea que debe recordar tu audiencia"/></Control>
        <Control label="Offer text"><textarea className="input" value={form.offer_text} onChange={event=>update('offer_text',event.target.value)} placeholder="Oferta o argumento comercial"/></Control>
        <Control label="Call to action"><input className="input" value={form.call_to_action} onChange={event=>update('call_to_action',event.target.value)}/></Control>
        <Control label="Target audience"><textarea className="input" value={form.target_audience} onChange={event=>update('target_audience',event.target.value)} placeholder="Necesidad, comportamiento y contexto"/></Control>
        <Control label="Focus tags"><Tags value={form.focus_tags} onChange={value=>update('focus_tags',value)}/></Control>
        <div className="workbench-form__two"><Control label="Aspect ratio"><select className="input" value={form.aspect_ratio} onChange={event=>update('aspect_ratio',event.target.value)}><option>4:5</option><option>1:1</option><option>9:16</option><option>16:9</option></select></Control><Control label="Resolution"><select className="input" value={form.resolution} onChange={event=>update('resolution',event.target.value)}><option>1K</option><option>2K</option><option>4K</option></select></Control></div>
        <div className="workbench-form__two"><Control label="Quality mode"><select className="input" value={form.quality_mode} onChange={event=>update('quality_mode',event.target.value)}><option value="draft">Borrador</option><option value="standard">Estándar</option><option value="high">Alta</option><option value="premium">Premium</option></select></Control><Control label="Variaciones"><input className="input" type="number" min="1" max="6" value={form.requested_variations} onChange={event=>update('requested_variations',event.target.value)}/></Control></div>
      </div><footer className="workbench-generate"><button type="button" onClick={generate} disabled={busy||!form.name.trim()||availableCredits<cost}><span>{busy?'Generando':'Generar'}</span><strong>{busy?'···':'↗'}</strong><small>{cost} créditos</small></button><p>{activeProject?'Actualiza y genera sobre el proyecto activo.':'Crea el proyecto y genera sus primeras imágenes.'}</p></footer></aside>
    </section>
  </main></>;
}

function Fallback(){return <><Nav privateNav/><main className="container creative-workbench-loading"><i/><span>Preparando el estudio creativo…</span></main></>;}
export default function NewProject(){return <Suspense fallback={<Fallback/>}><NewProjectContent/></Suspense>;}

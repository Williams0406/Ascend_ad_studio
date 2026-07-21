'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { api, ensureWorkspace } from '@/lib/api';
import { ObjectList } from '@/components/StructuredFields';

const emptyProduct = {
  name: '', short_description: '', description: '', brand_name: '', product_category: '',
  original_price: '', sale_price: '', discount_percentage: '', currency_code: 'PEN',
  primary_benefit: '', target_customer: '', product_url: '', main_image_asset: '',
  benefits: [], features: [], is_active: true,
};

function Field({ label, hint, required, children }) {
  return <label className="product-field"><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Money({ value, currency = 'PEN' }) {
  if (value === null || value === undefined || value === '') return 'Sin precio';
  try { return new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(Number(value)); } catch { return `${currency} ${value}`; }
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  async function load() {
    await ensureWorkspace();
    const [productData, assetData] = await Promise.all([
      api('/studio/products/'), api('/studio/brand-assets/'),
    ]);
    setProducts(productData.results || productData);
    setAssets((assetData.results || assetData).filter(asset => asset.mime_type?.startsWith('image/') || asset.file_url));
  }

  useEffect(() => { load().catch(error => setMessage({ type: 'error', text: error.message })); }, []);

  const filtered = useMemo(() => products.filter(product => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [product.name, product.brand_name, product.product_category, product.short_description].some(value => value?.toLowerCase().includes(term));
    const matchesStatus = status === 'all' || (status === 'active' ? product.is_active : !product.is_active);
    return matchesSearch && matchesStatus;
  }), [products, search, status]);

  const selectedAsset = assets.find(asset => asset.id === form.main_image_asset);
  function update(key, value) { setForm(current => ({ ...current, [key]: value })); }
  function flash(type, text) { setMessage({ type, text }); window.setTimeout(() => setMessage({ type: '', text: '' }), 4500); }

  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const nullableNumbers = ['original_price', 'sale_price', 'discount_percentage'];
      const payload = { ...form };
      nullableNumbers.forEach(key => { payload[key] = payload[key] === '' ? null : payload[key]; });
      payload.main_image_asset = payload.main_image_asset || null;
      const created = await api('/studio/products/', { method: 'POST', body: JSON.stringify(payload) });
      setProducts(current => [created, ...current]); setForm(emptyProduct); setFormOpen(false); setSelected(created); flash('success', 'Producto registrado correctamente.');
    } catch (error) { flash('error', error.message); } finally { setBusy(false); }
  }

  return <><Nav privateNav/><main className="container products-studio">
    <header className="products-header"><div><span className="eyebrow">Catálogo comercial</span><h1>Productos</h1><p>Organiza la información comercial y visual que alimenta tus campañas.</p></div><button className={`btn product-create-toggle ${formOpen ? 'open' : ''}`} onClick={() => setFormOpen(value => !value)}><span>{formOpen ? '×' : '+'}</span>{formOpen ? 'Cerrar formulario' : 'Registrar producto'}</button></header>
    {message.text && <div className={`brand-toast ${message.type}`}>{message.text}</div>}

    <section className={`product-form-shell ${formOpen ? 'open' : ''}`} aria-hidden={!formOpen}><form onSubmit={submit}><div className="product-form-head"><div><span>Nuevo registro</span><h2>Ficha de producto</h2></div><p>Completa los datos que la IA necesita para crear mensajes precisos y piezas relevantes.</p></div>
      <div className="product-form-body"><div className="product-form-main"><div className="form-section"><div className="form-section-title"><b>01</b><div><h3>Información básica</h3><p>Identificación y contexto del producto.</p></div></div><div className="product-fields two"><Field label="Nombre del producto" required><input className="input" required value={form.name} onChange={e => update('name',e.target.value)} placeholder="Ej. Audífonos X200"/></Field><Field label="Marca"><input className="input" value={form.brand_name} onChange={e => update('brand_name',e.target.value)} placeholder="Ej. Acme Audio"/></Field><Field label="Categoría"><input className="input" value={form.product_category} onChange={e => update('product_category',e.target.value)} placeholder="Ej. Electrónica"/></Field><Field label="URL del producto"><input className="input" type="url" value={form.product_url} onChange={e => update('product_url',e.target.value)} placeholder="https://…"/></Field></div><Field label="Descripción corta" hint={`${form.short_description.length}/500 · Ideal para tarjetas y resúmenes.`}><input className="input" maxLength="500" value={form.short_description} onChange={e => update('short_description',e.target.value)} placeholder="Una frase clara que explique el producto"/></Field><Field label="Descripción completa" hint="Incluye contexto, materiales, uso y diferenciadores."><textarea className="input product-textarea" value={form.description} onChange={e => update('description',e.target.value)} placeholder="Describe el producto con el nivel de detalle que usaría un vendedor experto…"/></Field></div>

        <div className="form-section"><div className="form-section-title"><b>02</b><div><h3>Precio y oferta</h3><p>Información para construir mensajes comerciales.</p></div></div><div className="product-fields four"><Field label="Precio original"><input className="input" type="number" min="0" step="0.01" value={form.original_price} onChange={e => update('original_price',e.target.value)} placeholder="0.00"/></Field><Field label="Precio de venta"><input className="input" type="number" min="0" step="0.01" value={form.sale_price} onChange={e => update('sale_price',e.target.value)} placeholder="0.00"/></Field><Field label="Descuento %"><input className="input" type="number" min="0" max="100" step="0.01" value={form.discount_percentage} onChange={e => update('discount_percentage',e.target.value)} placeholder="0"/></Field><Field label="Moneda"><select className="input" value={form.currency_code} onChange={e => update('currency_code',e.target.value)}><option value="PEN">PEN · Sol</option><option value="USD">USD · Dólar</option><option value="EUR">EUR · Euro</option><option value="MXN">MXN · Peso mexicano</option><option value="COP">COP · Peso colombiano</option><option value="CLP">CLP · Peso chileno</option></select></Field></div></div>

        <div className="form-section"><div className="form-section-title"><b>03</b><div><h3>Propuesta de valor</h3><p>Argumentos estructurados que orientarán el copy publicitario.</p></div></div><Field label="Beneficio principal" hint="El resultado más importante que recibe el cliente."><textarea className="input" value={form.primary_benefit} onChange={e => update('primary_benefit',e.target.value)} placeholder="Ej. Trabaja sin distracciones gracias a la cancelación de ruido"/></Field><Field label="Cliente objetivo" hint="Describe necesidades, contexto y motivaciones."><textarea className="input" value={form.target_customer} onChange={e => update('target_customer',e.target.value)} placeholder="Ej. Profesionales híbridos que necesitan concentración…"/></Field><div className="structured-section"><div className="structured-heading"><div><span>Beneficios</span><p>¿Qué resultado obtiene el cliente?</p></div></div><ObjectList value={form.benefits} onChange={value=>update('benefits',value)} addLabel="Agregar beneficio" fields={[{key:'title',label:'Beneficio',placeholder:'Duración prolongada'},{key:'priority',label:'Prioridad',type:'number',default:form.benefits.length+1,min:1},{key:'description',label:'Descripción',type:'textarea',wide:true,placeholder:'Explica el resultado para el cliente…'}]}/></div><div className="structured-section"><div className="structured-heading"><div><span>Características</span><p>Datos concretos, técnicos o funcionales.</p></div></div><ObjectList value={form.features} onChange={value=>update('features',value)} addLabel="Agregar característica" fields={[{key:'name',label:'Característica',placeholder:'Contenido'},{key:'value',label:'Valor',placeholder:'100 ml'},{key:'category',label:'Categoría',type:'select',default:'product',options:[['technical','Técnica'],['product','Producto'],['packaging','Empaque'],['other','Otra']]}]}/></div></div>
      </div>

      <aside className="product-image-picker"><div className="form-section-title"><b>04</b><div><h3>Imagen principal</h3><p>Selecciona un recurso de Brand Kit.</p></div></div><div className="chosen-product-image">{selectedAsset ? <img src={selectedAsset.file_url} alt={selectedAsset.name}/> : <div><span>Imagen de producto</span><small>Elige una opción de la biblioteca</small></div>}</div><div className="asset-choice-grid"><button type="button" className={!form.main_image_asset ? 'selected' : ''} onClick={() => update('main_image_asset','')}><span>Sin imagen</span></button>{assets.map(asset => <button type="button" key={asset.id} className={form.main_image_asset === asset.id ? 'selected' : ''} onClick={() => update('main_image_asset',asset.id)}><img src={asset.file_url} alt=""/><span>{asset.name}</span></button>)}</div>{!assets.length && <div className="picker-empty">No hay imágenes en BrandAsset.<Link href="/brand-kit">Subir recursos</Link></div>}<label className="product-active"><span><b>Producto activo</b><small>Disponible para nuevas campañas</small></span><input type="checkbox" checked={form.is_active} onChange={e => update('is_active',e.target.checked)}/><i/></label></aside></div>
      <div className="product-form-actions"><button type="button" className="btn secondary" onClick={() => {setForm(emptyProduct);setFormOpen(false)}}>Cancelar</button><button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button></div>
    </form></section>

    <section className="product-toolbar"><div className="product-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por producto, marca o categoría…"/></div><div className="status-filter">{[['all','Todos'],['active','Activos'],['inactive','Inactivos']].map(([key,label]) => <button key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}</button>)}</div><span className="result-count">{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</span></section>

    <section className="product-catalog">{filtered.map(product => <article className="product-card-new" key={product.id} tabIndex="0" role="button" onClick={() => setSelected(product)} onKeyDown={e => e.key === 'Enter' && setSelected(product)}><div className="product-card-image">{product.main_image_url ? <img src={product.main_image_url} alt={product.name}/> : <div><span>{product.name.slice(0,2).toUpperCase()}</span></div>}<i className={product.is_active ? 'active' : ''}>{product.is_active ? 'Activo' : 'Inactivo'}</i>{product.discount_percentage && <b>-{Number(product.discount_percentage).toFixed(0)}%</b>}</div><div className="product-card-body"><div className="product-card-meta"><span>{product.product_category || 'Sin categoría'}</span><small>{product.brand_name || 'Marca no definida'}</small></div><h3>{product.name}</h3><p>{product.short_description || product.primary_benefit || 'Sin descripción disponible.'}</p><div className="product-card-price">{product.sale_price && <strong><Money value={product.sale_price} currency={product.currency_code}/></strong>}{product.original_price && product.original_price !== product.sale_price && <del><Money value={product.original_price} currency={product.currency_code}/></del>}<button aria-label={`Ver detalle de ${product.name}`}>Ver ficha <span>→</span></button></div></div></article>)}{!filtered.length && <div className="products-empty"><span>Catálogo</span><h2>{products.length ? 'No encontramos coincidencias' : 'Registra tu primer producto'}</h2><p>{products.length ? 'Prueba con otra búsqueda o cambia el filtro.' : 'Construye una ficha completa para crear campañas más relevantes.'}</p>{!products.length && <button className="btn" onClick={() => setFormOpen(true)}>Registrar producto</button>}</div>}</section>

    {selected && <div className="product-detail-backdrop" onMouseDown={e => e.target === e.currentTarget && setSelected(null)}><aside className="product-detail" role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.name}`}><button className="detail-close" onClick={() => setSelected(null)} aria-label="Cerrar">×</button><div className="detail-hero">{selected.main_image_url ? <img src={selected.main_image_url} alt={selected.name}/> : <div>{selected.name.slice(0,2).toUpperCase()}</div>}<span>{selected.product_category || 'Producto'}</span></div><div className="detail-content"><div className="detail-title"><div><small>{selected.brand_name || 'Marca no definida'}</small><h2>{selected.name}</h2></div><i className={selected.is_active ? 'active' : ''}>{selected.is_active ? 'Activo' : 'Inactivo'}</i></div><p className="detail-lead">{selected.short_description || 'Sin descripción corta.'}</p><div className="detail-price"><strong><Money value={selected.sale_price} currency={selected.currency_code}/></strong>{selected.original_price && <del><Money value={selected.original_price} currency={selected.currency_code}/></del>}{selected.discount_percentage && <span>Ahorra {Number(selected.discount_percentage).toFixed(0)}%</span>}</div>{selected.description && <div className="detail-block"><span>Descripción</span><p>{selected.description}</p></div>}{selected.primary_benefit && <div className="detail-highlight"><span>Beneficio principal</span><p>{selected.primary_benefit}</p></div>}{selected.target_customer && <div className="detail-block"><span>Cliente objetivo</span><p>{selected.target_customer}</p></div>}<div className="detail-columns"><div><span>Beneficios</span>{selected.benefits?.length ? <ul>{selected.benefits.map((item,index) => <li key={index}><b>{typeof item==='string'?item:item.title}</b>{typeof item==='object'&&item.description&&<small>{item.description}</small>}</li>)}</ul> : <p>Sin beneficios registrados.</p>}</div><div><span>Características</span>{selected.features?.length ? <ul>{selected.features.map((item,index) => <li key={index}><b>{typeof item==='string'?item:item.name}</b>{typeof item==='object'&&<small>{item.value}</small>}</li>)}</ul> : <p>Sin características registradas.</p>}</div></div><div className="detail-actions">{selected.product_url && <a className="btn secondary" href={selected.product_url} target="_blank" rel="noreferrer">Ver página del producto</a>}<Link className="btn" href={`/projects/new?product=${selected.id}`}>Crear publicidad</Link></div></div></aside></div>}
  </main></>;
}

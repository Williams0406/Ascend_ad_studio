'use client';

import {useState} from 'react';

export function TagsInput({value=[],onChange,placeholder='Escribe y presiona Enter',limit=20}){
  const [draft,setDraft]=useState('');
  function add(){const next=draft.trim();if(next&&value.length<limit&&!value.includes(next))onChange([...value,next]);setDraft('')}
  return <div className="structured-tags"><div>{value.map((item,index)=><button type="button" key={`${item}-${index}`} onClick={()=>onChange(value.filter((_,i)=>i!==index))}>{item}<b>×</b></button>)}</div><input value={draft} placeholder={placeholder} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} onBlur={add}/><small>{value.length}/{limit}</small></div>
}

export function ObjectList({value=[],onChange,fields,addLabel='Agregar',emptyText='Aún no hay elementos.'}){
  const add=()=>onChange([...value,Object.fromEntries(fields.map(field=>[field.key,field.default??'']))]);
  const update=(index,key,next)=>onChange(value.map((item,i)=>i===index?{...item,[key]:next}:item));
  return <div className="object-list"><div className="object-list-items">{value.map((item,index)=><article key={item.id||index}><header><span>{String(index+1).padStart(2,'0')}</span><button type="button" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Eliminar</button></header><div className="object-list-fields">{fields.map(field=><label key={field.key} className={field.wide?'wide':''}><span>{field.label}</span>{field.type==='select'?<select className="input" value={item[field.key]??field.default??''} onChange={e=>update(index,field.key,e.target.value)}>{field.options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>:field.type==='color'?<div className="structured-color"><input type="color" value={item[field.key]||'#000000'} onChange={e=>update(index,field.key,e.target.value)}/><input className="input" value={item[field.key]||''} onChange={e=>update(index,field.key,e.target.value)}/></div>:field.type==='checkbox'?<input type="checkbox" checked={Boolean(item[field.key])} onChange={e=>update(index,field.key,e.target.checked)}/>:field.type==='textarea'?<textarea className="input" value={item[field.key]||''} onChange={e=>update(index,field.key,e.target.value)} placeholder={field.placeholder}/>:<input className="input" type={field.type||'text'} min={field.min} max={field.max} step={field.step} value={item[field.key]??''} onChange={e=>update(index,field.key,field.type==='number'?Number(e.target.value):e.target.value)} placeholder={field.placeholder}/>}</label>)}</div></article>)}</div>{!value.length&&<div className="empty-state">{emptyText}</div>}<button type="button" className="structured-add" onClick={add}>+ {addLabel}</button></div>
}

export function ChoiceCards({value=[],onChange,options}){
  return <div className="structured-choices">{options.map(([key,label,hint])=><button type="button" key={key} className={value.includes(key)?'active':''} onClick={()=>onChange(value.includes(key)?value.filter(v=>v!==key):[...value,key])}><i>{value.includes(key)?'✓':'+'}</i><span>{label}<small>{hint}</small></span></button>)}</div>
}

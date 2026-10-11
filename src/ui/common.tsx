import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import {sound} from '../audio/model';
import type { Card as CardType } from '../poker/types';
export async function api<T = any>(url: string, body?: unknown): Promise<T> { const res = await fetch('/api' + url, body === undefined ? undefined : body instanceof FormData ? { method: 'POST', headers: { 'x-monarch': '1' }, body } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-monarch': '1' }, body: JSON.stringify(body) }); const value = await res.json(); if (!res.ok)
    throw new Error(value.error ?? 'Request failed.'); return value; }
export function useLoad<T = any>(url: string, version = 0) { const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), previous=useRef(url); useEffect(() => { let active = true; if(previous.current!==url){setData(null);previous.current=url;} setError(''); api<T>(url).then(r => { if (active)
    setData(r); }).catch(e => { if (active)
    setError(e.message); }); return () => { active = false; }; }, [url, version]); return { data, error, setData }; }
export function Loading({ error = '' }: {
    error?: string;
}) { return <div className={`loading-state ${error ? 'load-error' : ''}`} role="status" aria-live="polite"><div className="loading-graphic" aria-hidden="true"><span>m.</span></div><div><h3>{error ? 'Unable to load data' : 'Loading'}</h3>{error ? <p>{error}</p> : <span className="loading-rule"/>}</div></div>; }
export function Empty({ title, children, action }: {
    icon: any;
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) { return <div className="empty"><span className="empty-rule" aria-hidden="true"/><div><h3>{title}</h3><p>{children}</p>{action}</div></div>; }
const ART='/study-film/art.js';
let art:Promise<{cardImage:(code:string)=>string}>|undefined;
function artwork(){return art??=import(/* @vite-ignore */ ART);}
export function Card({card,small=false,highlight=false}:{card?:CardType;small?:boolean;highlight?:boolean}){
 const [source,setSource]=useState('');
 useEffect(()=>{let live=true;artwork().then(module=>{if(live)setSource(module.cardImage(card||'back'));}).catch(()=>{});return()=>{live=false;};},[card]);
 return <span className={`playing-card ${small?'small':''} ${highlight?'highlight':''} ${card?.[1]==='h'||card?.[1]==='d'?'red':''}`} aria-label={card||'Hidden card'}>{source?<img src={source} alt="" draggable={false}/>:<span>{card||'m'}</span>}</span>;
}
export const Cards = ({ cards, small = false }: {
    cards: CardType[];
    small?: boolean;
}) => <span className="cards">{cards.map((c, i) => <Card key={c + i} card={c} small={small}/>)}</span>;
export const bb = (n: number, digits = 1) => (n > 0 ? '+' : '') + n.toFixed(digits);
export const pct = (n: number, d: number) => d ? (100 * n / d).toFixed(1) + '%' : "N/A";
export const dateLabel = (d: string) => !d ? "N/A" : d.endsWith('Z') ? new Date(d).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' }) : d.replace('T', ' ').slice(0, 16);
export function Metric({ label, value, detail, tone = '' }: {
    label: string;
    value: React.ReactNode;
    detail?: string;
    tone?: string;
}) { return <div className="metric"><span className="eyebrow">{label}</span><strong className={tone}><span className="metric-value" key={typeof value === 'string' || typeof value === 'number' ? value : undefined}>{value}</span></strong>{detail && <small>{detail}</small>}</div>; }
export function PageTitle({ title, description, actions }: {
    eyebrow: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) { return <div className="page-title"><div><h1><span key={title}>{title}</span></h1>{description && <p>{description}</p>}</div>{actions}</div>; }
export function SectionTitle({ title, sub, action }: {
    title: string;
    sub?: string;
    action?: React.ReactNode;
}) { return <div className="section-title"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</div>; }
export function Progress({ value, total }: {
    value: number;
    total: number;
}) { return <div className="progress-track"><div style={{ width: Math.min(100, value / total * 100) + '%' }}/></div>; }
export const ArrowLink = ({ children, onClick }: {
    children: React.ReactNode;
    onClick: () => void;
}) => <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>;
export const Notice = ({ children }: {
    children: React.ReactNode;
}) => <div className="notice"><AlertCircle size={17}/><span>{children}</span></div>;
export function useTask(toast: (s: string) => void) { const [busy, setBusy] = useState(false); async function run(fn: () => Promise<void>) { if (busy)
    return; setBusy(true); try {
    await fn();
}
catch (e) {
    sound('incorrect');toast((e as Error).message);
}
finally {
    setBusy(false);
} } return { busy, run }; }
export interface PageProps {
    go: (route: string) => void;
    version: number;
    refresh: () => void;
    toast: (s: string) => void;
}

export function Modal({ label, onClose, children }: { label:string; onClose:()=>void; children:React.ReactNode }) {
    const ref=useRef<HTMLDialogElement>(null);
    useEffect(()=>{ref.current?.showModal();sound('cut');},[]);
    return <dialog ref={ref} className="modal-backdrop" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal panel">{children}</section></dialog>;
}

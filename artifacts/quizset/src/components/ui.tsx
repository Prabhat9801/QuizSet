import { type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Button({children,className='',variant='primary',...props}:{children:ReactNode;className?:string;variant?:'primary'|'secondary'|'ghost'|'danger' } & ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`btn btn-${variant} ${className}`}>{children}</button> }
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'info'}) { return <span className={`badge badge-${tone}`}>{children}</span> }
export function Card({children,className='',...props}:{children:ReactNode;className?:string} & HTMLAttributes<HTMLElement>) { return <section {...props} className={`card ${className}`}>{children}</section> }
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) { return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><h3>{title}</h3><button data-testid="button-close-modal" onClick={onClose} className="icon-btn" aria-label="Close"><X size={18}/></button></div>{children}</div></div> }
export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div> }
export function Stat({label,value,delta,icon}:{label:string;value:string;delta?:string;icon?:ReactNode}) { return <Card className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span></div><strong>{value}</strong>{delta&&<small className="stat-delta">{delta}</small>}</Card> }
export function EmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}) { return <div className="empty"><div className="empty-mark">QS</div><h3>{title}</h3><p>{description}</p>{action}</div> }
export function Field({label,children,required}:{label:string;children:ReactNode;required?:boolean}) { return <label className="field"><span>{label}{required&&<i> *</i>}</span>{children}</label> }
export function Alert({children,tone='info'}:{children:ReactNode;tone?:'info'|'success'|'warning'|'danger'}) {
  if (!children) return null;
  return <div className={`alert alert-${tone}`}>{children}</div>;
}
export function Skeleton({className=''}:{className?:string}) {
  return <div className={`skeleton ${className}`} />;
}
export function SkeletonList({rows=3}:{rows?:number}) {
  return (
    <div className="skeleton-list">
      {Array.from({length: rows}, (_, i) => (
        <Skeleton key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
export function Tabs({tabs,value,onChange}:{tabs:{value:string;label:string;count?:number}[];value:string;onChange:(v:string)=>void}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && t.count > 0 ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}
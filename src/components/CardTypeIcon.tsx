import type { ReactNode } from 'react';

const aliases: Record<string, string> = { people: 'person', speaker: 'person', contact: 'person', programme: 'program', action: 'task', document: 'note', milestone: 'goal', link: 'resource' };
const icons: Record<string, ReactNode> = {
  person: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20v-2a7 7 0 0 1 14 0v2Z" opacity=".55" /></>,
  idea: <><path d="M8 15a7 7 0 1 1 8 0v2H8Z" opacity=".55" /><path d="M9 18h6v2H9zM10 21h4v1h-4z" /><path d="m10 10 2 2 2-2M12 12v5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  task: <><rect x="4" y="4" width="16" height="17" rx="3" opacity=".25" /><rect x="8" y="2" width="8" height="5" rx="2" /><path d="m8 13 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
  project: <><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3Z" opacity=".35" /><path d="M3 10h18l-2 10H5Z" opacity=".8" /></>,
  program: <><path d="M12 7v5M5 16v-4h14v4" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="8" y="2" width="8" height="6" rx="1.5" /><rect x="2" y="15" width="6" height="6" rx="1.5" opacity=".55" /><rect x="9" y="15" width="6" height="6" rx="1.5" opacity=".55" /><rect x="16" y="15" width="6" height="6" rx="1.5" opacity=".55" /></>,
  question: <><circle cx="12" cy="12" r="10" opacity=".18" /><path d="M9 8a3 3 0 1 1 5 2.2c-1.5 1-2 1.3-2 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17" r="1.2" /></>,
  note: <><path d="M5 2h10l5 5v15H5Z" opacity=".25" /><path d="M15 2v6h5" opacity=".6" /><path d="M8 12h9M8 15h9M8 18h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  decision: <><path d="m12 2 10 10-10 10L2 12Z" opacity=".3" /><path d="m8 12 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>,
  goal: <><circle cx="12" cy="12" r="10" opacity=".2" /><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" /></>,
  meeting: <><rect x="2" y="3" width="20" height="14" rx="4" opacity=".25" /><path d="m7 16-2 6 8-6Z" opacity=".25" /><circle cx="7" cy="10" r="1.5" /><circle cx="12" cy="10" r="1.5" /><circle cx="17" cy="10" r="1.5" /></>,
  event: <><rect x="3" y="4" width="18" height="18" rx="3" opacity=".25" /><path d="M3 9h18M8 2v5M16 2v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="7" y="13" width="4" height="4" rx="1" /></>,
  resource: <><rect x="3" y="3" width="7" height="18" rx="2" opacity=".55" /><path d="m13 3 6-1 3 18-6 1Z" opacity=".3" /><path d="M5 16h3m8-1 3-.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></>,
  risk: <><path d="M10.3 3a2 2 0 0 1 3.4 0l9 16a2 2 0 0 1-1.7 3H3a2 2 0 0 1-1.7-3Z" opacity=".25" /><path d="M12 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="18" r="1.2" /></>,
  custom: <><rect x="3" y="3" width="18" height="18" rx="5" opacity=".25" /><path d="m12 6 6 6-6 6-6-6Z" opacity=".7" /></>,
};

// Derive the choices from the icon registry so every supported type stays listed.
export const cardTypes = [...Object.keys(icons), ...Object.keys(aliases)].map(type => type[0].toUpperCase() + type.slice(1));

export function CardTypeIcon({ type }: { type?: string }) {
  const label = type?.trim() || '', key = label.toLowerCase();
  const kind = !key ? 'question' : Object.hasOwn(aliases, key) ? aliases[key] : Object.hasOwn(icons, key) ? key : 'custom';
  return <span className="card-type-icon" title={label || 'No type'} data-card-type-icon={kind}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={label ? `${label} type` : 'No type'}>{icons[kind]}</svg>
  </span>;
}

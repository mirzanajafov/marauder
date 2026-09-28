import { useState } from 'react';
import { Entity } from '@marauder/shared';

interface Props {
  entities: Entity[];
  onTag: (id: string, name: string) => Promise<void>;
  authed: boolean;
}

export function AdminPanel({ entities, onTag, authed }: Props) {
  const unknown = entities.filter((e) => e.status === 'unknown');
  const tagged = entities.filter((e) => e.status === 'tagged');

  return (
    <aside className="panel">
      <section>
        <h2>Unknown ({unknown.length})</h2>
        {unknown.length === 0 && <p className="muted">none yet</p>}
        {unknown.map((e) => (
          <TagRow key={e.id} entity={e} onTag={onTag} authed={authed} />
        ))}
      </section>
      <section>
        <h2>Tagged ({tagged.length})</h2>
        {tagged.length === 0 && <p className="muted">none yet</p>}
        {tagged.map((e) => (
          <div key={e.id} className="row done">
            <span className="name">{e.name}</span>
            <span className="fp">{e.fingerprint}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

function TagRow({ entity, onTag, authed }: { entity: Entity; onTag: (id: string, name: string) => Promise<void>; authed: boolean }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!name.trim()) {
      return;
    }
    setBusy(true);
    try {
      await onTag(entity.id, name.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <span className="fp">{entity.fingerprint}</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={authed ? 'assign a name' : 'log in to tag'}
        disabled={busy || !authed}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void submit();
          }
        }}
      />
      <button onClick={() => void submit()} disabled={busy || !name.trim() || !authed}>
        tag
      </button>
    </div>
  );
}

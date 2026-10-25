import { useState } from 'react';
import { Entity } from '@marauder/shared';
import { tagEntity } from './api';
import { useAction } from './session';

interface Props {
  entities: readonly Entity[];
  onTagged: (entity: Entity) => void;
}

export function RosterPanel({ entities, onTagged }: Props) {
  const unknown = entities.filter((e) => e.status === 'unknown');
  const tagged = entities.filter((e) => e.status === 'tagged');

  return (
    <aside className="panel">
      <section>
        <h2>Unknown ({unknown.length})</h2>
        {unknown.length === 0 && <p className="muted">none yet</p>}
        {unknown.map((e) => (
          <TagRow key={e.id} entity={e} onTagged={onTagged} />
        ))}
      </section>
      <section>
        <h2>Tagged ({tagged.length})</h2>
        {tagged.length === 0 && <p className="muted">none yet</p>}
        {tagged.map((e) => (
          <div key={e.id} className="row done">
            <span className="name">{e.name}</span>
            <span className="id">{e.fingerprint}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

function TagRow({ entity, onTagged }: { entity: Entity; onTagged: (entity: Entity) => void }) {
  const [name, setName] = useState('');
  const { busy, error, run, allowed } = useAction();

  const submit = async (): Promise<void> => {
    const tagged = await run(async (token) => {
      onTagged(await tagEntity(token, entity.id, { name: name.trim() }));
    });
    if (tagged) {
      setName('');
    }
  };

  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <span className="id">{entity.fingerprint}</span>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={allowed ? 'assign a name' : 'log in to tag'}
        aria-label={`name for ${entity.fingerprint}`}
        disabled={busy || !allowed}
      />
      <button type="submit" disabled={busy || !allowed || name.trim() === ''}>
        tag
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

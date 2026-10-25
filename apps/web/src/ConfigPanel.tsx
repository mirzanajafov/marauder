import { useState } from 'react';
import { FloorPlan, Receiver } from '@marauder/shared';
import { createReceiver, deleteReceiver, updateFloorPlan, updateReceiver } from './api';
import { parseNumber } from './fields';
import { FloorMap } from './FloorMap';
import { useAction } from './session';

interface Props {
  plan: FloorPlan;
  receivers: readonly Receiver[];
  onPlanChange: (plan: FloorPlan) => void;
  onReceiversChange: () => void;
}

interface Draft {
  id: string;
  name: string;
  x: string;
  y: string;
}

const EMPTY_DRAFT: Draft = { id: '', name: '', x: '', y: '' };

export function ConfigPanel({ plan, receivers, onPlanChange, onReceiversChange }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  return (
    <div className="layout">
      <FloorMap
        plan={plan}
        receivers={receivers}
        markers={[]}
        onMapClick={(x, y) => setDraft((d) => ({ ...d, x: String(x), y: String(y) }))}
      />
      <aside className="panel">
        <FloorPlanForm key={`${plan.imageUrl ?? ''}|${plan.width}|${plan.height}`} plan={plan} onSaved={onPlanChange} />
        <AddReceiver plan={plan} draft={draft} onDraft={setDraft} onAdded={onReceiversChange} />
        <section>
          <h2>Receivers ({receivers.length})</h2>
          {receivers.map((r) => (
            <ReceiverRow key={`${r.id}|${r.name}|${r.x}|${r.y}`} receiver={r} onChange={onReceiversChange} />
          ))}
        </section>
      </aside>
    </div>
  );
}

function FloorPlanForm({ plan, onSaved }: { plan: FloorPlan; onSaved: (plan: FloorPlan) => void }) {
  const [imageUrl, setImageUrl] = useState(plan.imageUrl ?? '');
  const [width, setWidth] = useState(String(plan.width));
  const [height, setHeight] = useState(String(plan.height));
  const { busy, error, run, allowed } = useAction();

  const save = async (): Promise<void> => {
    await run(async (token) => {
      onSaved(
        await updateFloorPlan(token, {
          imageUrl: imageUrl.trim() === '' ? null : imageUrl.trim(),
          width: parseNumber('width', width),
          height: parseNumber('height', height),
          floor: plan.floor,
        }),
      );
    });
  };

  return (
    <section>
      <h2>Floor plan</h2>
      <label className="field">
        <span>image url</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </label>
      <div className="dims">
        <label className="field">
          <span>width (m)</span>
          <input value={width} onChange={(e) => setWidth(e.target.value)} inputMode="decimal" />
        </label>
        <label className="field">
          <span>height (m)</span>
          <input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <button className="primary" onClick={() => void save()} disabled={busy || !allowed}>
        save floor plan
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

interface AddReceiverProps {
  plan: FloorPlan;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onAdded: () => void;
}

function AddReceiver({ plan, draft, onDraft, onAdded }: AddReceiverProps) {
  const { busy, error, run, allowed } = useAction();
  const ready = draft.id.trim() !== '' && draft.name.trim() !== '';

  const add = async (): Promise<void> => {
    const added = await run(async (token) => {
      await createReceiver(token, {
        id: draft.id.trim(),
        name: draft.name.trim(),
        x: parseNumber('x', draft.x),
        y: parseNumber('y', draft.y),
        floor: plan.floor,
      });
    });
    if (added) {
      onDraft(EMPTY_DRAFT);
      onAdded();
    }
  };

  const field = (key: keyof Draft, placeholder: string, numeric = false) => (
    <input
      value={draft[key]}
      onChange={(e) => onDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      aria-label={`new receiver ${placeholder}`}
      inputMode={numeric ? 'decimal' : undefined}
    />
  );

  return (
    <section>
      <h2>Add receiver</h2>
      <p className="muted">click the map to set position</p>
      <div className="grid2">
        {field('id', 'id')}
        {field('name', 'name')}
        {field('x', 'x', true)}
        {field('y', 'y', true)}
      </div>
      <button className="primary" onClick={() => void add()} disabled={busy || !allowed || !ready}>
        add
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function ReceiverRow({ receiver, onChange }: { receiver: Receiver; onChange: () => void }) {
  const [name, setName] = useState(receiver.name);
  const [x, setX] = useState(String(receiver.x));
  const [y, setY] = useState(String(receiver.y));
  const { busy, error, run, allowed } = useAction();

  const save = async (): Promise<void> => {
    const saved = await run(async (token) => {
      await updateReceiver(token, receiver.id, { name: name.trim(), x: parseNumber('x', x), y: parseNumber('y', y) });
    });
    if (saved) {
      onChange();
    }
  };

  const remove = async (): Promise<void> => {
    if (await run((token) => deleteReceiver(token, receiver.id))) {
      onChange();
    }
  };

  return (
    <div className="row receiver-row">
      <div className="receiver-name">
        <span className="id">{receiver.id}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          aria-label={`${receiver.id} name`}
        />
      </div>
      <input
        className="num"
        value={x}
        onChange={(e) => setX(e.target.value)}
        disabled={busy}
        inputMode="decimal"
        aria-label={`${receiver.id} x`}
      />
      <input
        className="num"
        value={y}
        onChange={(e) => setY(e.target.value)}
        disabled={busy}
        inputMode="decimal"
        aria-label={`${receiver.id} y`}
      />
      <button onClick={() => void save()} disabled={busy || !allowed}>
        save
      </button>
      <button
        className="danger"
        onClick={() => void remove()}
        disabled={busy || !allowed}
        aria-label={`delete ${receiver.id}`}
      >
        ✕
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

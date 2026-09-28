import { useState } from 'react';
import { FloorPlan, Receiver } from '@marauder/shared';
import { createReceiver, deleteReceiver, updateFloorPlan, updateReceiver } from './api';
import { FloorMap } from './FloorMap';

interface Props {
  receivers: Receiver[];
  floor: FloorPlan;
  onReceiversChange: () => void;
  onFloorChange: (floor: FloorPlan) => void;
}

const NO_POSITIONS = {};
const NO_ENTITIES = {};

export function ConfigPanel({ receivers, floor, onReceiversChange, onFloorChange }: Props) {
  const [imageUrl, setImageUrl] = useState(floor.imageUrl ?? '');
  const [width, setWidth] = useState(String(floor.width));
  const [height, setHeight] = useState(String(floor.height));
  const [draft, setDraft] = useState({ id: '', name: '', x: '', y: '' });

  const saveFloor = async (): Promise<void> => {
    const next = await updateFloorPlan({
      imageUrl: imageUrl.trim() === '' ? null : imageUrl.trim(),
      width: Number(width),
      height: Number(height),
      floor: floor.floor,
    });
    onFloorChange(next);
  };

  const addReceiver = async (): Promise<void> => {
    if (draft.id.trim() === '' || draft.name.trim() === '') {
      return;
    }
    await createReceiver({
      id: draft.id.trim(),
      name: draft.name.trim(),
      x: Number(draft.x || 0),
      y: Number(draft.y || 0),
      floor: floor.floor,
    });
    setDraft({ id: '', name: '', x: '', y: '' });
    onReceiversChange();
  };

  return (
    <div className="layout">
      <FloorMap
        width={floor.width}
        height={floor.height}
        imageUrl={floor.imageUrl}
        receivers={receivers}
        entities={NO_ENTITIES}
        positions={NO_POSITIONS}
        onMapClick={(x, y) => setDraft((d) => ({ ...d, x: String(x), y: String(y) }))}
      />
      <aside className="panel">
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
          <button className="primary" onClick={() => void saveFloor()}>
            save floor plan
          </button>
        </section>

        <section>
          <h2>Add receiver</h2>
          <p className="muted">click the map to set position</p>
          <div className="grid2">
            <input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="id" />
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="name" />
            <input value={draft.x} onChange={(e) => setDraft({ ...draft, x: e.target.value })} placeholder="x" inputMode="decimal" />
            <input value={draft.y} onChange={(e) => setDraft({ ...draft, y: e.target.value })} placeholder="y" inputMode="decimal" />
          </div>
          <button className="primary" onClick={() => void addReceiver()} disabled={!draft.id.trim() || !draft.name.trim()}>
            add
          </button>
        </section>

        <section>
          <h2>Receivers ({receivers.length})</h2>
          {receivers.map((r) => (
            <ReceiverRow key={r.id} receiver={r} onChange={onReceiversChange} />
          ))}
        </section>
      </aside>
    </div>
  );
}

function ReceiverRow({ receiver, onChange }: { receiver: Receiver; onChange: () => void }) {
  const [name, setName] = useState(receiver.name);
  const [x, setX] = useState(String(receiver.x));
  const [y, setY] = useState(String(receiver.y));
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await updateReceiver(receiver.id, { name: name.trim(), x: Number(x), y: Number(y) });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    setBusy(true);
    try {
      await deleteReceiver(receiver.id);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <span className="fp">{receiver.id}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      <input className="num" value={x} onChange={(e) => setX(e.target.value)} disabled={busy} inputMode="decimal" />
      <input className="num" value={y} onChange={(e) => setY(e.target.value)} disabled={busy} inputMode="decimal" />
      <button onClick={() => void save()} disabled={busy}>
        save
      </button>
      <button className="danger" onClick={() => void remove()} disabled={busy}>
        ✕
      </button>
    </div>
  );
}

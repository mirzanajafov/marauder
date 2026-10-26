import { useState } from 'react';
import { DEFAULT_FLOORPLAN } from '@marauder/shared';
import { ConfigPanel } from './ConfigPanel';
import { FloorMap } from './FloorMap';
import { HistoryView } from './HistoryView';
import { LoginForm } from './LoginForm';
import { RosterPanel } from './RosterPanel';
import { SessionContext, useAuth } from './session';
import { useLayout } from './useLayout';
import { useLiveTracking } from './useLiveTracking';

type Mode = 'live' | 'history' | 'config';

const MODES: readonly Mode[] = ['live', 'history', 'config'];

export function App() {
  const [mode, setMode] = useState<Mode>('live');
  const auth = useAuth();
  const layout = useLayout();
  const live = useLiveTracking();
  const plan = layout.plan ?? DEFAULT_FLOORPLAN;
  const failures = [...layout.failures, live.failure].filter((failure) => failure !== null);

  return (
    <SessionContext.Provider value={auth.session}>
      <div className="app">
        <header className="topbar">
          <h1>Marauder</h1>
          <div className="modes">
            {MODES.map((m) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </div>
          {mode === 'live' && (
            <span className={live.connected ? 'status on' : 'status off'}>{live.connected ? 'live' : 'offline'}</span>
          )}
          {auth.session.token === null ? (
            <LoginForm onLogin={auth.login} />
          ) : (
            <div className="auth">
              <span className="admin-badge">admin</span>
              <button onClick={() => void auth.logout()} disabled={auth.loggingOut}>
                logout
              </button>
            </div>
          )}
        </header>
        {auth.notice !== null && (
          <p className="problem" role="alert">
            {auth.notice}
          </p>
        )}
        {failures.map(({ message, retry }) => (
          <p key={message} className="problem" role="alert">
            {message}
            <button className="retry" onClick={retry}>
              retry
            </button>
          </p>
        ))}
        <main className="layout">
          {mode === 'live' && (
            <>
              <FloorMap plan={plan} receivers={layout.receivers} markers={live.markers} />
              <RosterPanel entities={live.entities} onTagged={live.rememberEntity} />
            </>
          )}
          {mode === 'history' && <HistoryView plan={plan} receivers={layout.receivers} />}
          {mode === 'config' &&
            (layout.plan ? (
              <ConfigPanel
                plan={layout.plan}
                receivers={layout.receivers}
                onPlanChange={layout.setPlan}
                onReceiversChange={layout.reloadReceivers}
              />
            ) : (
              <div className="map">
                <p className="centered muted">the floor plan has to load before it can be edited</p>
              </div>
            ))}
        </main>
      </div>
    </SessionContext.Provider>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { FloorPlan, Receiver } from '@marauder/shared';
import { describeError, fetchFloorPlan, fetchReceivers } from './api';

interface LoadFailure {
  message: string;
  retry: () => void;
}

function useLoaded<T>(load: () => Promise<T>, initial: T, what: string) {
  const [value, setValue] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    let current = true;
    load().then(
      (loaded) => {
        if (current) {
          setValue(loaded);
          setError(null);
        }
      },
      (failure: unknown) => {
        if (current) {
          setError(`could not load the ${what}: ${describeError(failure)}`);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [load, what, loads]);

  const reload = useCallback(() => setLoads((count) => count + 1), []);
  const failure: LoadFailure | null = error === null ? null : { message: error, retry: reload };

  return { value, setValue, reload, failure };
}

export function useLayout() {
  const plan = useLoaded<FloorPlan | null>(fetchFloorPlan, null, 'floor plan');
  const receivers = useLoaded<Receiver[]>(fetchReceivers, [], 'receivers');

  return {
    plan: plan.value,
    setPlan: plan.setValue,
    receivers: receivers.value,
    reloadReceivers: receivers.reload,
    failures: [plan.failure, receivers.failure].filter((failure) => failure !== null),
  };
}

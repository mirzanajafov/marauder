import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

export interface LoadFailure {
  message: string;
  retry: () => void;
}

export function replaceWith<T>(_current: T, loaded: T): T {
  return loaded;
}

export function useLoaded<T, L = T>(
  load: () => Promise<L>,
  apply: (current: T, loaded: L) => T,
  initial: T,
  what: string,
) {
  const [value, setValue] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    let current = true;
    load().then(
      (loaded) => {
        if (current) {
          setValue((previous) => apply(previous, loaded));
          setError(null);
        }
      },
      (failure: unknown) => {
        if (current) {
          setError(`could not load the ${what}: ${errorMessage(failure)}`);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [load, apply, what, loads]);

  const reload = useCallback(() => setLoads((count) => count + 1), []);
  const failure: LoadFailure | null = error === null ? null : { message: error, retry: reload };

  return { value, setValue, reload, failure };
}

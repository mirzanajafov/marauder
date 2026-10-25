import { useCallback, useEffect, useRef, useState } from 'react';
import { FloorPlan, Receiver } from '@marauder/shared';
import { describeError, fetchFloorPlan, fetchReceivers } from './api';

export function useLayout() {
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [receiversError, setReceiversError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const latestReload = useRef(0);

  const reloadReceivers = useCallback(() => {
    latestReload.current += 1;
    const reload = latestReload.current;
    fetchReceivers().then(
      (list) => {
        if (reload === latestReload.current) {
          setReceivers(list);
          setReceiversError(null);
        }
      },
      (failure: unknown) => {
        if (reload === latestReload.current) {
          setReceiversError(`could not load the receivers: ${describeError(failure)}`);
        }
      },
    );
  }, []);

  useEffect(() => {
    reloadReceivers();
    fetchFloorPlan().then(
      (loaded) => {
        setPlan(loaded);
        setPlanError(null);
      },
      (failure: unknown) => setPlanError(`could not load the floor plan: ${describeError(failure)}`),
    );
  }, [reloadReceivers]);

  return { receivers, plan, setPlan, reloadReceivers, errors: [planError, receiversError] };
}

import { FloorPlan, Receiver } from '@marauder/shared';
import { fetchFloorPlan, fetchReceivers } from './api';
import { useLoaded } from './useLoaded';

export function useLayout() {
  const plan = useLoaded<FloorPlan | null>(fetchFloorPlan, null, 'floor plan');
  const receivers = useLoaded<Receiver[]>(fetchReceivers, [], 'receivers');

  return {
    plan: plan.value,
    setPlan: plan.setValue,
    receivers: receivers.value,
    reloadReceivers: receivers.reload,
    failures: [plan.failure, receivers.failure],
  };
}

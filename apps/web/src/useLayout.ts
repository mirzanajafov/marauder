import { FloorPlan, Receiver } from '@marauder/shared';
import { fetchFloorPlan, fetchReceivers } from './api';
import { replaceWith, useLoaded } from './useLoaded';

export function useLayout() {
  const plan = useLoaded<FloorPlan | null>(fetchFloorPlan, replaceWith, null, 'floor plan');
  const receivers = useLoaded<Receiver[]>(fetchReceivers, replaceWith, [], 'receivers');

  return {
    plan: plan.value,
    setPlan: plan.setValue,
    receivers: receivers.value,
    reloadReceivers: receivers.reload,
    failures: [plan.failure, receivers.failure],
  };
}

import { TrailPoint } from './trails';

export interface Marker {
  id: string;
  x: number;
  y: number;
  label: string;
  trail: readonly TrailPoint[];
}

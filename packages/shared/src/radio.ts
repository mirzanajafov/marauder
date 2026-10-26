export const DEFAULT_TX_POWER = -59;
export const DEFAULT_PATH_LOSS_EXPONENT = 2.5;
export const LOWEST_DBM = -127;
export const HIGHEST_DBM = 20;

export function isReportableDbm(value: unknown): value is number {
  return typeof value === 'number' && value >= LOWEST_DBM && value <= HIGHEST_DBM;
}

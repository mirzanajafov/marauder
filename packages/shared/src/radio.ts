export const DEFAULT_TX_POWER = -59;
export const DEFAULT_PATH_LOSS_EXPONENT = 2.5;
export const LOWEST_DBM = -127;
export const HIGHEST_DBM = 20;

export function isReportableDbm(dbm: number): boolean {
  return dbm >= LOWEST_DBM && dbm <= HIGHEST_DBM;
}

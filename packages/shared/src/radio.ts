export const DEFAULT_TX_POWER = -59;
export const DEFAULT_PATH_LOSS_EXPONENT = 2.5;
export const NO_SIGNAL_DBM = -127;
export const HIGHEST_DBM = 20;

export function isReportableDbm(dbm: number): boolean {
  return dbm > NO_SIGNAL_DBM && dbm <= HIGHEST_DBM;
}

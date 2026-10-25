import { Logger } from '@nestjs/common';

const FAILURE_LOG_INTERVAL_MS = 30_000;

export class ThrottledLog {
  private failures = 0;
  private lastLogged = Number.NEGATIVE_INFINITY;

  constructor(private readonly logger: Logger) {}

  failure(describe: (failures: number) => string): void {
    this.failures += 1;
    const now = performance.now();
    if (now - this.lastLogged >= FAILURE_LOG_INTERVAL_MS) {
      this.lastLogged = now;
      this.logger.error(describe(this.failures));
    }
  }
}

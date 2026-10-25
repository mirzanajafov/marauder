import { Logger } from '@nestjs/common';
import { ThrottledLog } from './throttled-log';

describe('ThrottledLog', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs the first failure, counts the next ones quietly and reports the running count after 30 s', () => {
    jest.useFakeTimers();
    const logger = new Logger('test');
    const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const failures = new ThrottledLog(logger);
    const report = (count: number): string => `${count} failures so far`;

    failures.failure(report);
    failures.failure(report);
    failures.failure(report);
    jest.advanceTimersByTime(29_999);
    failures.failure(report);
    expect(error.mock.calls).toEqual([['1 failures so far']]);

    jest.advanceTimersByTime(1);
    failures.failure(report);
    expect(error.mock.calls).toEqual([['1 failures so far'], ['5 failures so far']]);
  });
});

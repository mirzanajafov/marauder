import { reportStep } from './visit';

describe('visit', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('hands the step to the visit script as a najafov:action event on the document', () => {
    const target = new EventTarget();
    Object.defineProperty(globalThis, 'document', { value: target, configurable: true });
    const steps: unknown[] = [];
    target.addEventListener('najafov:action', (event) => {
      steps.push(event instanceof CustomEvent ? event.detail : event);
    });

    reportStep('replayed');

    expect(steps).toEqual(['replayed']);
  });
});

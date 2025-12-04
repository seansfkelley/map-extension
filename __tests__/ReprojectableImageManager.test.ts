import { AssertionError } from '../src/util';
import { OperationState, ReprojectionOperation } from '../src/ReprojectableImageManager';

describe(ReprojectionOperation, () => {
  let onUpdateMock: jest.Mock<(fraction: number) => void>;
  let abortMock: jest.Mock<() => void>;
  let onEndMock: jest.Mock<(state: Exclude<OperationState, 'in-progress'>) => void>;
  let operation: ReprojectionOperation;

  beforeEach(() => {
    onUpdateMock = jest.fn();
    abortMock = jest.fn();
    onEndMock = jest.fn();
    operation = new ReprojectionOperation(onUpdateMock, abortMock, onEndMock);
  });

  it('should start in the "in-progress" state', () => {
    expect(operation.state).toBe('in-progress');
  });

  it('should immediately call `onUpdate` with 0', () => {
    expect(onUpdateMock).toHaveBeenCalledWith(0);
  });

  it('should pass through values from `updateProgress` until the operation ends', () => {
    operation.updateProgress(0.5);
    expect(onUpdateMock).toHaveBeenCalledTimes(2);
    expect(onUpdateMock).toHaveBeenLastCalledWith(0.5);
    operation.onComplete();
    expect(() => {
      operation.updateProgress(1);
    }).toThrow();
    expect(onUpdateMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['aborted', 'onAborted' as const],
    ['completed', 'onComplete' as const],
    ['failed', 'onFailed' as const],
  ])('should call `onEnd` with "%s" and throw on all future interactions', (result, fn) => {
    operation[fn]();
    expect(onEndMock).toHaveBeenCalledWith(result);
    expect(operation.state).toBe(result);
    expect(() => {
      operation.onAborted();
    }).toThrow(AssertionError);
    expect(() => {
      operation.onComplete();
    }).toThrow(AssertionError);
    expect(() => {
      operation.onFailed();
    }).toThrow(AssertionError);
    expect(() => {
      operation.updateProgress(0);
    }).toThrow(AssertionError);
  });
});

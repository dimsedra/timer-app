import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimerEngine } from '../src/core/timerEngine';

describe('TimerEngine', () => {
  let engine: TimerEngine;

  beforeEach(() => {
    engine = new TimerEngine();
  });

  it('creates a timer with idle state', () => {
    const timer = engine.addTimer('Work Cycle', 300, true);
    expect(timer.id).toBeDefined();
    expect(timer.label).toBe('Work Cycle');
    expect(timer.durationSeconds).toBe(300);
    expect(timer.remainingSeconds).toBe(300);
    expect(timer.loop).toBe(true);
    expect(timer.state).toBe('idle');
  });

  it('starts a timer and calculates remaining time based on timestamp delta', () => {
    const timer = engine.addTimer('Test', 60, false);
    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    expect(engine.getTimer(timer.id)?.state).toBe('running');
    expect(engine.getTimer(timer.id)?.endTimestamp).toBe(startTime + 60000);

    // 10 seconds later
    engine.tick(startTime + 10000);
    expect(engine.getTimer(timer.id)?.remainingSeconds).toBe(50);
  });

  it('pauses a timer accurately preserving remaining seconds', () => {
    const timer = engine.addTimer('Test', 60, false);
    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // Advance 25 seconds
    engine.tick(startTime + 25000);
    engine.pauseTimer(timer.id, startTime + 25000);

    const paused = engine.getTimer(timer.id);
    expect(paused?.state).toBe('paused');
    expect(paused?.remainingSeconds).toBe(35);
    expect(paused?.endTimestamp).toBeNull();
  });

  it('completes non-looping timer and resets to idle', () => {
    const timer = engine.addTimer('Single', 10, false);
    const completeCb = vi.fn();
    engine.onComplete(completeCb);

    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // Advance past end
    engine.tick(startTime + 10500);

    expect(completeCb).toHaveBeenCalledWith(expect.objectContaining({ id: timer.id }));
    const finished = engine.getTimer(timer.id);
    expect(finished?.state).toBe('idle');
    expect(finished?.remainingSeconds).toBe(10);
  });

  it('automatically loops continuously when loop is enabled without drift', () => {
    const timer = engine.addTimer('Looping', 10, true);
    const completeCb = vi.fn();
    engine.onComplete(completeCb);

    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // First cycle finishes at +10s
    engine.tick(startTime + 10000);
    expect(completeCb).toHaveBeenCalledTimes(1);

    const afterFirstLoop = engine.getTimer(timer.id);
    expect(afterFirstLoop?.state).toBe('running');
    expect(afterFirstLoop?.endTimestamp).toBe(startTime + 20000);
    expect(afterFirstLoop?.remainingSeconds).toBe(10);

    // Advance 3s into the second cycle
    engine.tick(startTime + 13000);
    expect(engine.getTimer(timer.id)?.remainingSeconds).toBe(7);
  });
});

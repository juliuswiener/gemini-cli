/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamAggregator, EnrichedServerGeminiStreamEvent } from './streamAggregator.js';
import { ServerGeminiStreamEvent, GeminiEventType } from './turn.js';

interface ConcurrentCall {
  id: string;
  prompt: string;
}

// Helper function to create mock async generators
async function* createMockStream(
  events: ServerGeminiStreamEvent[],
  delay: number = 0
): AsyncGenerator<ServerGeminiStreamEvent> {
  for (const event of events) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    yield event;
  }
}

// Helper function to create mock async generator that throws an error
async function* createErrorStream(
  events: ServerGeminiStreamEvent[],
  errorAfter: number = 1
): AsyncGenerator<ServerGeminiStreamEvent> {
  let count = 0;
  for (const event of events) {
    if (count >= errorAfter) {
      throw new Error(`Stream error after ${errorAfter} events`);
    }
    yield event;
    count++;
  }
}

describe('StreamAggregator', () => {
  let calls: ConcurrentCall[];
  let aggregator: StreamAggregator;

  beforeEach(() => {
    calls = [
      { id: 'call1', prompt: 'Analyze security' },
      { id: 'call2', prompt: 'Check performance' },
      { id: 'call3', prompt: 'Review code quality' }
    ];
    aggregator = new StreamAggregator(calls);
  });

  describe('constructor', () => {
    it('should initialize with concurrent calls metadata', () => {
      expect(aggregator).toBeDefined();
      expect(aggregator).toBeInstanceOf(StreamAggregator);
    });
  });

  describe('mergeStreams', () => {
    it('should successfully combine events from multiple parallel streams', async () => {
      // Create mock streams with different event types
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Content from call1' },
        { type: GeminiEventType.Finished, value: 'STOP' as any }
      ];
      
      const stream2Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Content from call2' },
        { type: GeminiEventType.Finished, value: 'STOP' as any }
      ];

      const streams = [
        createMockStream(stream1Events),
        createMockStream(stream2Events)
      ];

      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      // Should have all events from both streams
      expect(aggregatedEvents).toHaveLength(4);
      
      // Check that events have proper attribution
      const call1Events = aggregatedEvents.filter(e => e.callId === 'call1');
      const call2Events = aggregatedEvents.filter(e => e.callId === 'call2');
      
      expect(call1Events).toHaveLength(2);
      expect(call2Events).toHaveLength(2);
    });

    it('should enrich events with callId and callTitle properties', async () => {
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Test content' }
      ];

      const streams = [createMockStream(stream1Events)];
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(1);
      const event = aggregatedEvents[0];
      
      // Check enrichment properties
      expect(event.callId).toBe('call1');
      expect(event.callTitle).toBe('Analyze security');
      
      // Check original event properties are preserved
      expect(event.type).toBe(GeminiEventType.Content);
      expect(event.value).toBe('Test content');
    });

    it('should handle three parallel streams correctly', async () => {
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Stream 1 content' }
      ];
      
      const stream2Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Stream 2 content' }
      ];
      
      const stream3Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Stream 3 content' }
      ];

      const streams = [
        createMockStream(stream1Events),
        createMockStream(stream2Events),
        createMockStream(stream3Events)
      ];

      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(3);
      
      // Verify all three calls are represented
      const callIds = new Set(aggregatedEvents.map(e => e.callId));
      expect(callIds).toEqual(new Set(['call1', 'call2', 'call3']));
      
      // Verify call titles are correct
      const call1Event = aggregatedEvents.find(e => e.callId === 'call1');
      const call2Event = aggregatedEvents.find(e => e.callId === 'call2');
      const call3Event = aggregatedEvents.find(e => e.callId === 'call3');
      
      expect(call1Event?.callTitle).toBe('Analyze security');
      expect(call2Event?.callTitle).toBe('Check performance');
      expect(call3Event?.callTitle).toBe('Review code quality');
    });

    it('should continue processing other streams when one stream fails', async () => {
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Content before error' },
        { type: GeminiEventType.Content, value: 'This will cause error' }
      ];
      
      const stream2Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Stream 2 content 1' },
        { type: GeminiEventType.Content, value: 'Stream 2 content 2' }
      ];

      const streams = [
        createErrorStream(stream1Events, 1), // Will throw error after 1 event
        createMockStream(stream2Events)
      ];

      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      // Should have: 1 content from stream1, 1 error event, 2 content from stream2
      expect(aggregatedEvents.length).toBeGreaterThanOrEqual(3);
      
      // Check that stream2 events are still present
      const stream2Events_received = aggregatedEvents.filter(e => e.callId === 'call2');
      expect(stream2Events_received).toHaveLength(2);
      
      // Check that error event was generated
      const errorEvents = aggregatedEvents.filter(e => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].callId).toBe('call1');
      
      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should generate proper error events when stream fails', async () => {
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Content before error' }
      ];

      const streams = [createErrorStream(stream1Events, 1)];
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      // Should have 1 content event + 1 error event
      expect(aggregatedEvents).toHaveLength(2);
      
      const errorEvent = aggregatedEvents.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.callId).toBe('call1');
      expect(errorEvent?.callTitle).toBe('Analyze security');
      expect(errorEvent?.value).toEqual({
        error: {
          message: 'Error in call call1: Stream error after 1 events',
          status: undefined
        }
      });
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle empty streams array', async () => {
      const streams: AsyncGenerator<ServerGeminiStreamEvent>[] = [];
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(0);
    });

    it('should handle streams that complete immediately', async () => {
      const emptyStream = async function* (): AsyncGenerator<ServerGeminiStreamEvent> {
        return;
      };

      const streams = [emptyStream()];
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(0);
    });

    it('should maintain ServerGeminiStreamEvent type with added properties', async () => {
      const stream1Events: ServerGeminiStreamEvent[] = [
        { 
          type: GeminiEventType.ToolCallRequest, 
          value: {
            callId: 'tool-call-1',
            name: 'test_tool',
            args: { param: 'value' },
            isClientInitiated: false,
            prompt_id: 'test-prompt'
          }
        }
      ];

      const streams = [createMockStream(stream1Events)];
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      
      for await (const event of aggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(1);
      const event = aggregatedEvents[0];
      
      // Check that original ServerGeminiStreamEvent properties are preserved
      expect(event.type).toBe(GeminiEventType.ToolCallRequest);
      expect(event.value).toEqual({
        callId: 'tool-call-1',
        name: 'test_tool',
        args: { param: 'value' },
        isClientInitiated: false,
        prompt_id: 'test-prompt'
      });
      
      // Check that enrichment properties are added
      expect(event.callId).toBe('call1');
      expect(event.callTitle).toBe('Analyze security');
    });

    it('should use callId as callTitle fallback when call metadata is missing', async () => {
      // Create aggregator with limited metadata
      const limitedCalls = [{ id: 'call1', prompt: 'Analyze security' }];
      const limitedAggregator = new StreamAggregator(limitedCalls);
      
      const stream1Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Test content' }
      ];
      
      const stream2Events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Test content 2' }
      ];

      // Pass 2 streams but only have metadata for 1
      const streams = [
        createMockStream(stream1Events),
        createMockStream(stream2Events)
      ];
      
      const aggregatedEvents: EnrichedServerGeminiStreamEvent[] = [];
      for await (const event of limitedAggregator.mergeStreams(streams)) {
        aggregatedEvents.push(event);
      }

      expect(aggregatedEvents).toHaveLength(2);
      
      // First event should have proper title
      const call1Event = aggregatedEvents.find(e => e.callId === 'call1');
      expect(call1Event?.callTitle).toBe('Analyze security');
      
      // Second event should fallback to callId since metadata is missing
      const call2Event = aggregatedEvents.find(e => e.callId === 'call2');
      expect(call2Event?.callTitle).toBe('call2');
    });
  });
});
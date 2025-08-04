/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerGeminiStreamEvent } from './turn.js';

// Define the enriched stream event type
export type EnrichedStreamEvent = ServerGeminiStreamEvent & {
  _metadata: {
    callId: string;
    originalPrompt: string;
    executionId: string;
    timestamp: number;
  };
};

/**
 * Multiplexes multiple async generators into a single stream with metadata enrichment.
 */
export class StreamMultiplexer {
  /**
   * Merges multiple async generators with metadata enrichment.
   * @param generators - Array of generators with metadata
   * @param signal - Abort signal to cancel the merging
   * @returns An async generator that yields enriched stream events
   */
  static async *mergeStreamsWithMetadata<T extends ServerGeminiStreamEvent>(
    generators: Array<{
      generator: AsyncGenerator<T>;
      callId: string;
      originalPrompt: string;
      executionId: string;
    }>,
    signal: AbortSignal,
  ): AsyncGenerator<EnrichedStreamEvent> {
    // Create an array to hold the promises for the next value from each generator
    const promises = generators.map(({ generator }, index) =>
      generator.next().then((result) => ({ result, index })),
    );

    // Continue until all generators are done
    while (promises.length > 0 && !signal.aborted) {
      try {
        // Wait for the first promise to resolve
        const { result, index } = await Promise.race(promises);

        // Remove the resolved promise from the array
        const promiseIndex = promises.findIndex(
          (p) => p === Promise.race(promises),
        );
        if (promiseIndex !== -1) {
          promises.splice(promiseIndex, 1);
        }

        // If the generator is done, skip it
        if (result.done) {
          continue;
        }

        // Enrich the event with metadata
        const enrichedEvent: EnrichedStreamEvent = {
          ...result.value,
          _metadata: {
            callId: generators[index].callId,
            originalPrompt: generators[index].originalPrompt,
            executionId: generators[index].executionId,
            timestamp: Date.now(),
          },
        };

        // Yield the enriched event
        yield enrichedEvent;

        // Add the next promise from the same generator
        promises.push(
          generators[index].generator
            .next()
            .then((result) => ({ result, index })),
        );
      } catch (error) {
        // If a generator throws an error, we'll stop processing it
        console.error(`Error in stream:`, error);
        // Remove the promise that threw an error
        const errorPromise = promises.find((p) => p === Promise.race(promises));
        if (errorPromise) {
          const promiseIndex = promises.indexOf(errorPromise);
          if (promiseIndex !== -1) {
            promises.splice(promiseIndex, 1);
          }
        }
      }
    }

    // If aborted, throw an error
    if (signal.aborted) {
      throw new Error('Stream merging aborted');
    }
  }

  /**
   * Interleaved merging for optimal performance.
   * @param generators - Array of async generators
   * @param signal - Abort signal to cancel the merging
   * @returns An async generator that yields events in interleaved order
   */
  static async *interleavedMerge<T>(
    generators: Array<AsyncGenerator<T>>,
    signal: AbortSignal,
  ): AsyncGenerator<T> {
    // Create an array to hold the promises for the next value from each generator
    const promises = generators.map((generator, index) =>
      generator.next().then((result) => ({ result, index })),
    );

    // Continue until all generators are done
    while (promises.length > 0 && !signal.aborted) {
      try {
        // Wait for the first promise to resolve
        const { result, index } = await Promise.race(promises);

        // Remove the resolved promise from the array
        if (result.done) {
          continue;
        }

        // Yield the value
        yield result.value;

        // Add the next promise from the same generator
        promises.push(
          generators[index].next().then((result) => ({ result, index })),
        );
      } catch (error) {
        // If a generator throws an error, we'll stop processing it
        console.error(`Error in stream:`, error);
        // Find and remove the generator that threw an error
        const racedPromise = Promise.race(promises);
        const errorIndex = promises.findIndex((p) => p === racedPromise);
        if (errorIndex !== -1) {
          promises.splice(errorIndex, 1);
        }
      }
    }

    // If aborted, throw an error
    if (signal.aborted) {
      throw new Error('Stream merging aborted');
    }
  }
}

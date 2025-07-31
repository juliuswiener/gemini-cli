/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerGeminiStreamEvent, GeminiEventType } from './turn.js';

interface ConcurrentCall {
  id: string;
  prompt: string;
}

/**
 * Extended ServerGeminiStreamEvent with concurrency attribution
 */
export type EnrichedServerGeminiStreamEvent = ServerGeminiStreamEvent & {
  callId: string;
  callTitle: string;
};

/**
 * StreamAggregator merges multiple AsyncGenerator streams from concurrent calls
 * into a single coherent output stream with proper attribution and error handling.
 */
export class StreamAggregator {
  private callMetadata: Map<string, ConcurrentCall>;

  constructor(calls: ConcurrentCall[]) {
    this.callMetadata = new Map(calls.map(call => [call.id, call]));
  }

  /**
   * Merges multiple AsyncGenerator streams into a single output stream.
   * Each event is enriched with callId and callTitle for attribution.
   * Individual stream errors are handled gracefully without stopping other streams.
   */
  async *mergeStreams(
    streams: AsyncGenerator<ServerGeminiStreamEvent>[]
  ): AsyncGenerator<EnrichedServerGeminiStreamEvent> {
    // Create an array of call IDs in the same order as the calls array
    const callIds = Array.from(this.callMetadata.keys());
    const activeGenerators = streams.map((generator, index) => ({
      generator,
      callId: callIds[index], // Use the call ID at the same index
      done: false,
      buffer: [] // Optional: for reordering or buffering if needed later
    }));

    while (activeGenerators.some(g => !g.done)) {
      for (const genInfo of activeGenerators) {
        if (genInfo.done) continue;

        try {
          const { value, done } = await genInfo.generator.next();
          if (done) {
            genInfo.done = true;
          } else {
            // Enrich event with callId and callTitle
            const originalCall = this.callMetadata.get(genInfo.callId);
            const enrichedEvent: EnrichedServerGeminiStreamEvent = {
              ...value,
              callId: genInfo.callId,
              callTitle: originalCall?.prompt || genInfo.callId // Use prompt as title
            };
            yield enrichedEvent;
          }
        } catch (error) {
          // Basic error handling: log and mark as done, but don't stop other streams
          console.error(`Stream for call ${genInfo.callId} encountered an error:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorEvent: EnrichedServerGeminiStreamEvent = {
            type: GeminiEventType.Error,
            value: {
              error: {
                message: `Error in call ${genInfo.callId}: ${errorMessage}`,
                status: undefined
              }
            },
            callId: genInfo.callId,
            callTitle: this.callMetadata.get(genInfo.callId)?.prompt || genInfo.callId
          };
          yield errorEvent;
          genInfo.done = true;
        }
      }
      // Add a small delay to prevent busy-waiting if streams are slow
      // await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}
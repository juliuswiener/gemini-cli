/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import { RetryAttemptEvent } from '../telemetry/types.js';

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
}

export interface RetryContext {
  callId: string;
  attempt: number;
  lastError?: Error;
  nextRetryTime?: number;
}

/**
 * Manages retry logic for concurrent API calls.
 */
export class RetryManager {
  private retryContexts: Map<string, RetryContext>;
  private readonly defaultConfig: RetryConfig;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
    this.retryContexts = new Map();
    this.defaultConfig = {
      maxRetries: config.getRetryConfig().maxRetries,
      backoffMs: config.getRetryConfig().backoffMs,
      exponentialBackoff: config.getRetryConfig().exponentialBackoff,
      retryableErrors: config.getRetryConfig().retryableErrors,
    };
  }

  /**
   * Determines if a call should be retried based on the error and retry configuration.
   * @param callId - The ID of the call
   * @param error - The error that occurred
   * @returns True if the call should be retried, false otherwise
   */
  shouldRetry(callId: string, error: Error): boolean {
    const context = this.getRetryContext(callId) || { callId, attempt: 0 };
    const config = this.defaultConfig;
    
    // Check if we've exceeded max retries
    if (context.attempt >= config.maxRetries) {
      return false;
    }
    
    // Check if error is retryable
    return this.isRetryableError(error, config);
  }

  /**
   * Executes an operation with retry logic.
   * @param callId - The ID of the call
   * @param operation - The operation to execute
   * @param config - Optional retry configuration to override defaults
   * @returns A promise that resolves to the result of the operation
   * @throws Error if the operation fails after all retries
   */
  async executeWithRetry<T>(
    callId: string,
    operation: () => Promise<T>,
    config?: RetryConfig
  ): Promise<T> {
    const retryConfig = config || this.defaultConfig;
    let context = this.getRetryContext(callId);
    
    if (!context) {
      context = { callId, attempt: 0 };
      this.retryContexts.set(callId, context);
    }
    
    while (true) {
      try {
        const result = await operation();
        // Success - clear context and return result
        this.retryContexts.delete(callId);
        return result;
      } catch (error) {
        // Update context with error
        context.lastError = error as Error;
        
        // Check if we should retry
        if (context.attempt >= retryConfig.maxRetries || !this.isRetryableError(error as Error, retryConfig)) {
          // No more retries - throw the error
          this.retryContexts.delete(callId);
          throw error;
        }
        
        // Increment attempt count
        context.attempt++;
        
        // Calculate backoff
        const backoffMs = this.calculateBackoff(context.attempt, retryConfig);
        context.nextRetryTime = Date.now() + backoffMs;
        
        // Log retry attempt
        if (this.config.getTelemetryEnabled()) {
          // TODO: Implement proper telemetry logging
        }
        
        // Wait for backoff
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  /**
   * Gets the retry context for a call.
   * @param callId - The ID of the call
   * @returns The retry context or undefined if not found
   */
  getRetryContext(callId: string): RetryContext | undefined {
    return this.retryContexts.get(callId);
  }

  /**
   * Calculates the backoff time for a retry attempt.
   * @param attempt - The attempt number
   * @param config - The retry configuration
   * @returns The backoff time in milliseconds
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    if (config.exponentialBackoff) {
      return config.backoffMs * Math.pow(2, attempt - 1);
    }
    return config.backoffMs;
  }

  /**
   * Determines if an error is retryable based on the retry configuration.
   * @param error - The error to check
   * @param config - The retry configuration
   * @returns True if the error is retryable, false otherwise
   */
  private isRetryableError(error: Error, config: RetryConfig): boolean {
    if (!error || !error.message) {
      return false;
    }
    
    // Check if any retryable error pattern matches
    return config.retryableErrors.some(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        try {
          const regex = new RegExp(pattern.slice(1, -1));
          return regex.test(error.message);
        } catch {
          // Invalid regex, treat as literal string
          return error.message.includes(pattern);
        }
      } else {
        // Literal string
        return error.message.includes(pattern);
      }
    });
  }
}
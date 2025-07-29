/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Config } from '../config/config.js';
import { FileLockAcquiredEvent, FileLockReleasedEvent } from '../telemetry/types.js';

export interface FileLock {
  path: string;
  lockId: string;
  acquiredAt: number;
  callId: string;
}

export interface LockRequest {
  path: string;
  callId: string;
  timeout: number;
}

/**
 * Manages file locking to prevent race conditions during concurrent tool execution.
 */
export class FileLockManager {
  private locks: Map<string, FileLock>;
  private queue: Map<string, LockRequest[]>;
  private readonly config: Config;
  private readonly lockDirectory: string;

  constructor(config: Config) {
    this.config = config;
    this.locks = new Map();
    this.queue = new Map();
    this.lockDirectory = config.getFileLockingConfig().lockDirectory;
    
    // Ensure lock directory exists
    if (!fs.existsSync(this.lockDirectory)) {
      fs.mkdirSync(this.lockDirectory, { recursive: true });
    }
  }

  /**
   * Acquires a lock for a file path.
   * @param request - The lock request containing file path, call ID, and timeout
   * @returns A promise that resolves to the acquired FileLock
   * @throws Error if the lock cannot be acquired within the timeout
   */
  async acquireLock(request: LockRequest): Promise<FileLock> {
    const { path: filePath, callId, timeout } = request;
    const lockFilePath = this.getLockFilePath(filePath);
    
    // Check if already locked
    if (this.isLocked(filePath)) {
      // Add to queue
      if (!this.queue.has(filePath)) {
        this.queue.set(filePath, []);
      }
      this.queue.get(filePath)!.push(request);
      
      // Wait for lock to be released
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // Remove from queue
          const queue = this.queue.get(filePath) || [];
          const index = queue.findIndex(req => req.callId === callId);
          if (index !== -1) {
            queue.splice(index, 1);
          }
          reject(new Error(`Timeout waiting for lock on ${filePath}`));
        }, timeout);
        
        // Check periodically if lock is available
        const checkInterval = setInterval(() => {
          if (!this.isLocked(filePath)) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            
            // Try to acquire lock
            this.tryAcquireLock(filePath, callId, lockFilePath)
              .then(resolve)
              .catch(reject);
          }
        }, 100);
      });
    }
    
    // Try to acquire lock immediately
    return this.tryAcquireLock(filePath, callId, lockFilePath);
  }

  /**
   * Releases a lock for a file path.
   * @param lockId - The ID of the lock to release
   * @returns A promise that resolves when the lock is released
   */
  async releaseLock(lockId: string): Promise<void> {
    for (const [filePath, lock] of this.locks.entries()) {
      if (lock.lockId === lockId) {
        const lockFilePath = this.getLockFilePath(filePath);
        
        // Log release event
        if (this.config.getTelemetryEnabled()) {
          // TODO: Implement proper telemetry logging
        }
        
        // Remove lock file
        try {
          if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
          }
        } catch (error) {
          console.warn(`Failed to remove lock file ${lockFilePath}:`, error);
        }
        
        // Remove from locks map
        this.locks.delete(filePath);
        
        // Process queue
        this.processQueue(filePath);
        return;
      }
    }
  }

  /**
   * Checks if a file path is currently locked.
   * @param filePath - The file path to check
   * @returns True if the file is locked, false otherwise
   */
  isLocked(filePath: string): boolean {
    return this.locks.has(filePath);
  }

  /**
   * Gets information about the lock on a file path.
   * @param filePath - The file path to check
   * @returns The FileLock information or undefined if not locked
   */
  getLockInfo(filePath: string): FileLock | undefined {
    return this.locks.get(filePath);
  }

  /**
   * Processes the lock queue for a file path.
   * @param filePath - The file path to process the queue for
   */
  private processQueue(filePath: string): void {
    const queue = this.queue.get(filePath);
    if (!queue || queue.length === 0) {
      return;
    }
    
    // Process the next request in the queue
    const nextRequest = queue.shift();
    if (nextRequest) {
      this.tryAcquireLock(nextRequest.path, nextRequest.callId, this.getLockFilePath(nextRequest.path))
        .catch(error => {
          console.warn(`Failed to acquire lock for queued request:`, error);
        });
    }
  }

  /**
   * Tries to acquire a lock for a file path.
   * @param filePath - The file path to lock
   * @param callId - The call ID requesting the lock
   * @param lockFilePath - The path to the lock file
   * @returns A promise that resolves to the acquired FileLock
   * @throws Error if the lock cannot be acquired
   */
  private async tryAcquireLock(filePath: string, callId: string, lockFilePath: string): Promise<FileLock> {
    try {
      // Create lock file
      fs.writeFileSync(lockFilePath, callId, { flag: 'wx' });
      
      // Create lock object
      const lock: FileLock = {
        path: filePath,
        lockId: this.generateLockId(),
        acquiredAt: Date.now(),
        callId,
      };
      
      // Add to locks map
      this.locks.set(filePath, lock);
      
      // Log acquisition event
      if (this.config.getTelemetryEnabled()) {
        // TODO: Implement proper telemetry logging
      }
      
      return lock;
    } catch (error: unknown) {
      throw new Error(`Failed to acquire lock on ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a unique lock ID.
   * @returns A unique lock ID
   */
  private generateLockId(): string {
    return `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets the lock file path for a file path.
   * @param filePath - The file path to get the lock file path for
   * @returns The lock file path
   */
  private getLockFilePath(filePath: string): string {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath).replace(/\//g, '_').replace(/\\/g, '_');
    return path.join(this.lockDirectory, `${dirName}_${fileName}.lock`);
  }
}
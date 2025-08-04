/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';

// A simple logging utility to avoid adding a dependency for this script.
const log = {
  info: (msg) => console.log(`\u001b[34m${msg}\u001b[39m`), // blue
  success: (msg) => console.log(`\u001b[32m${msg}\u001b[39m`), // green
  error: (msg) => console.error(`\u001b[31m${msg}\u001b[39m`), // red
  bold: (msg) => `\u001b[1m${msg}\u001b[22m`,
  yellow: (msg) => console.log(`\u001b[33m${msg}\u001b[39m`),
};

const steps = [
  { name: 'Cleaning workspace', command: 'npm run clean' },
  { name: 'Installing dependencies with "npm ci"', command: 'npm ci' },
  { name: 'Formatting code', command: 'npm run format' },
  { name: 'Linting code', command: 'npm run lint:ci' },
  { name: 'Building project', command: 'npm run build' },
  { name: 'Type checking', command: 'npm run typecheck' },
  { name: 'Running tests', command: 'npm run test:ci' },
];

function run() {
  log.yellow(log.bold('🚀 Starting preflight checks...'));

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNumber = i + 1;
    const totalSteps = steps.length;
    const stepTitle = `[${stepNumber}/${totalSteps}] ${step.name}`;

    console.log(''); // Add a newline for spacing
    log.info(
      '================================================================',
    );
    log.info(log.bold(stepTitle));
    log.info(
      '================================================================',
    );
    console.log(`> ${step.command}\n`);

    try {
      execSync(step.command, { stdio: 'inherit' });
      log.success(`\n✓ Success: ${step.name} completed.`);
    } catch (_error) {
      log.error(`\n✗ Failed: ${step.name}.`);
      process.exit(1);
    }
  }

  console.log('');
  log.success(log.bold('\n✅ All preflight checks passed successfully!'));
}

run();

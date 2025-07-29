#!/usr/bin/env python3
import argparse
import os
import select
import subprocess
import sys
import time
import re
import signal
from pathlib import Path

def main():
    """
    Runs a Gemini CLI command with a background telemetry collector,
    then prints the collected telemetry log.
    """
    parser = argparse.ArgumentParser(
        description="Run a Gemini CLI command with telemetry and capture the log."
    )
    parser.add_argument(
        "prompt",
        type=str,
        nargs="?",
        default="Test",
        help="The prompt to send to the Gemini CLI. "
        "Defaults to 'Test' if not provided.",
    )
    args = parser.parse_args()

    # Assume the script is in a 'scripts' folder at the project root.
    project_root = Path(__file__).parent.parent.resolve()

    print(f"Project Root: {project_root}")

    telemetry_process = None
    pids_to_kill = set()
    collector_log_path = None
    try:
        # 2. Start the telemetry collector in the background
        telemetry_cmd = ["npm", "run", "telemetry", "--", "--target=local"]
        print(f"Starting telemetry collector: {' '.join(telemetry_cmd)}")
        # We redirect stdout to a pipe to read its output for the ready signal.
        telemetry_process = subprocess.Popen(
            telemetry_cmd,
            cwd=project_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
        )
        print(f"Telemetry collector started with PID: {telemetry_process.pid}")
        pids_to_kill.add(telemetry_process.pid)

        # 3. Wait for the collector to initialize by reading its output
        print("Waiting for telemetry collector to signal readiness ('Press Ctrl+C to exit')...")
        print("--- Telemetry Collector Startup Log ---")
        ready_signal = "OTEL collector started successfully"
        timeout_seconds = 30
        ready = False

        poller = select.poll()
        poller.register(telemetry_process.stdout, select.POLLIN)

        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            if telemetry_process.poll() is not None:
                print("Telemetry collector process exited prematurely.", file=sys.stderr)
                break

            if poller.poll(10):  # Poll for 10ms
                line = telemetry_process.stdout.readline()
                if not line: # EOF
                    break
                # Always print the output for debugging. Use end='' as readline() keeps the newline.
                print(line, end='')

                # Find and store the collector log path
                # This regex is more robust, handling optional whitespace and not assuming a leading '/'
                # which makes it more platform-agnostic (e.g., for Windows paths).
                log_path_match = re.search(r".*Logs:\s*(.+collector\.log)", line)
                if log_path_match:
                    collector_log_path = Path(log_path_match.group(1))
                    print(f"Found collector log path: {collector_log_path}")

                # Find and store any PIDs mentioned in the output
                pid_match = re.search(r'\(PID: (\d+)\)', line)
                if pid_match:
                    pid = int(pid_match.group(1))
                    print(f"Found child process PID to track: {pid}")
                    pids_to_kill.add(pid)

                if ready_signal in line:
                    print("--- Telemetry collector is ready. ---")
                    ready = True
                    break

        if not ready:
            # Ensure the log block is closed on timeout
            print("--- End Telemetry Collector Startup Log ---")
            # Raise an exception to be handled by the main `except` block.
            # This ensures the `finally` block is always executed for cleanup.
            raise RuntimeError(f"Telemetry collector did not signal readiness within {timeout_seconds}s.")

        if not collector_log_path:
            raise RuntimeError("Could not determine collector log path from telemetry output.")

        # 4. Run the main Gemini CLI command and wait for it to complete
        main_cmd = [
            "npm", "run", "start", "--",
            "--prompt", args.prompt,
            "--telemetry",
            "--yolo",
            "--debug",
        ]
        print(f"\nRunning main command and streaming its output: {' '.join(main_cmd)}")
        print("--- Main Command Output START ---")
        # We run this command and wait for it to complete. Its output will be
        # streamed directly to the console, as we don't redirect stdout/stderr.
        subprocess.run(main_cmd, cwd=project_root, check=True)
        print("--- Main Command Output END ---")
        print("Main command finished successfully.")

        # 4.5. Wait for the collector.log to be written by the telemetry process
        print("\nWaiting for telemetry data to be written to collector.log...")
        log_wait_timeout = 20
        log_wait_start = time.time()
        log_found = False
        while time.time() - log_wait_start < log_wait_timeout:
            if collector_log_path.exists() and collector_log_path.stat().st_size > 0:
                print("collector.log has been created and is not empty.")
                log_found = True
                break
            time.sleep(0.5)

        if not log_found:
            print(f"Warning: collector.log did not appear at {collector_log_path} within {log_wait_timeout}s.", file=sys.stderr)

    except (subprocess.CalledProcessError, FileNotFoundError, RuntimeError) as e:
        print(f"\nAn error occurred: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # 5. This block runs regardless of success or failure to ensure cleanup.
        #    We ensure all discovered background processes are terminated.
        if pids_to_kill:
            print("\nScript ending. Terminating collected processes...")
            # Kill child processes first, then the parent, by sorting PIDs descending.
            for pid in sorted(list(pids_to_kill), reverse=True):
                try:
                    print(f"Sending SIGTERM to process with PID: {pid}...")
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    # This is expected if the process terminated on its own.
                    print(f"Process with PID {pid} not found (already terminated).")
                except Exception as e:
                    print(f"Error terminating PID {pid}: {e}", file=sys.stderr)

        # After sending signals, wait for the main Popen object to clean up its resources.
        if telemetry_process:
            telemetry_process.wait(timeout=5)
        print("Cleanup complete.")

    # 6. Find and print the collector.log file
    print(f"\nReading log file: {collector_log_path}")
    if not collector_log_path or not collector_log_path.exists():
        print(f"\nError: collector.log not found at expected path: {collector_log_path}", file=sys.stderr)
        sys.exit(1)

    print(f"\n--- Contents of {collector_log_path} ---")
    print(collector_log_path.read_text())
    print("--- End of log file ---")

if __name__ == "__main__":
    main()
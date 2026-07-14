import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { stopProcess } from "./child-process.mjs";

void test("waits for process exit after SIGKILL", async () => {
  const childProcess = new EventEmitter();
  childProcess.exitCode = null;
  childProcess.signalCode = null;
  childProcess.signals = [];
  childProcess.kill = (signal) => {
    childProcess.signals.push(signal);
    if (signal === "SIGKILL") {
      setTimeout(() => {
        childProcess.signalCode = signal;
        childProcess.emit("exit", null, signal);
      }, 20);
    }
    return true;
  };

  await stopProcess(childProcess, 1);

  assert.deepEqual(childProcess.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(childProcess.signalCode, "SIGKILL");
});

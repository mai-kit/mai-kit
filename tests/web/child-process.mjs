export async function stopProcess(childProcess, gracePeriodMs = 2_000) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return;

  const exited = new Promise((resolveExit) => childProcess.once("exit", resolveExit));
  childProcess.kill("SIGTERM");

  let timeout;
  const exitedGracefully = await Promise.race([
    exited.then(() => true),
    new Promise((resolveTimeout) => {
      timeout = setTimeout(() => resolveTimeout(false), gracePeriodMs);
    }),
  ]);
  clearTimeout(timeout);
  if (exitedGracefully) return;

  if (childProcess.exitCode === null && childProcess.signalCode === null) {
    childProcess.kill("SIGKILL");
  }
  await exited;
}

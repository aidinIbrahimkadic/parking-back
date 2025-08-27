import { runFetchOnce } from "./fetchJob.js";

runFetchOnce()
  .then((res) => {
    console.log("[fetch-once] ", res);
  })
  .catch((e) => {
    console.error("[fetch-once][error]", e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

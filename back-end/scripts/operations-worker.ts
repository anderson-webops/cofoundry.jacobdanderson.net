import process from "node:process"
import { runOperationsWorker } from "../src/operations-worker.js"

runOperationsWorker(process.argv.slice(2)).catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { delay } from "@lib/utils/delay";

async function updateProgressTx(progress, debugMsg) {
  this.progressTx = progress;
  this.debug = debugMsg;
  await delay(100);
}

async function resetProgressTx() {
  this.progressTx = 0;
  this.debug = "";
}

async function getProgressTx() {
  return this.progressTx;
}

async function getDebugMessage() {
  return this.debug;
}

export default {
  updateProgressTx,
  resetProgressTx,
  getProgressTx,
  getDebugMessage,
};

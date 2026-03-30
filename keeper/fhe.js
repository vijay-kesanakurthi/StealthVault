const { cofhejs, FheTypes } = require("cofhejs/node");
const { provider, wallet } = require("./config.js");

let fheReady = false;

function unwrap(result, label) {
  if (!result?.success) {
    throw new Error(`${label} failed: ${result?.error?.message || "unknown error"}`);
  }
  return result.data;
}

async function initFHE() {
  const env = process.env.FHE_ENV || "TESTNET";
  const initRes = await cofhejs.initializeWithEthers({
    ethersProvider: provider,
    ethersSigner: wallet,
    environment: env,
    generatePermit: true,
  });
  unwrap(initRes, "cofhejs.initializeWithEthers");
  fheReady = true;
  console.log("FHE initialized:", env);
}

function getFHE() {
  if (!fheReady) throw new Error("FHE not initialized");
  return {
    async decryptBool(cipherHandle) {
      const res = await cofhejs.decrypt(BigInt(cipherHandle), FheTypes.Bool);
      return unwrap(res, "decryptBool");
    },
  };
}

module.exports = { initFHE, getFHE };

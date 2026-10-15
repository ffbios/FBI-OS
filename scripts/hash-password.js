"use strict";

const { createPasswordHash } = require("../lib/admin-auth");

async function readHiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    return input.replace(/[\r\n]+$/, "");
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let password = "";
    process.stdout.write("Administrator password (minimum 12 characters): ");
    stdin.setRawMode(true);
    stdin.resume();
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = chunk => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(password);
          return;
        }
        if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
        else if (char >= " " && char !== "\u007f") password += char;
      }
    };
    stdin.on("data", onData);
  });
}

(async () => {
  try {
    const password = await readHiddenPassword();
    const hash = await createPasswordHash(password);
    process.stdout.write("Copy this value into the user's passwordHash field in FBI_HQ_USERS_JSON:\n");
    process.stdout.write(hash + "\n");
  } catch (error) {
    console.error(error.message || "Could not create password hash.");
    process.exitCode = 1;
  }
})();

import { randomBytes } from "crypto";

function generateRecoveryCode() {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  const randomBuffer = randomBytes(10); // Always returns a Buffer of length 10
  let result = "";
  for (let i = 0; i < 10; i++) {
    // randomBuffer[i] is 0-255, so mod by charactersLength
    result += characters.charAt(randomBuffer[i]! % charactersLength);
  }
  return result.toUpperCase();
}

export function generateRecoveryCodes() {
  const recoveryCodes = [];
  for (let i = 0; i < 10; i++) {
    recoveryCodes.push(generateRecoveryCode());
  }
  return recoveryCodes;
}

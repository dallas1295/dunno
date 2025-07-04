import argon2 from "argon2";
import { validatePassword } from "@/utils/user";

const ARGON2_CONFIG = {
  memory: 64 * 1024,
  iterations: 3,
  keyLength: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  if (!validatePassword(password)) {
    throw new Error(
      "Invalid password: must be at least 8 characters long, atleast 2 numbers, and atleast 2 special characters",
    );
  }

  try {
    const hash = await argon2.hash(password, {
      memoryCost: ARGON2_CONFIG.memory,
      timeCost: ARGON2_CONFIG.iterations,
      hashLength: ARGON2_CONFIG.keyLength,
    });
    return hash;
  } catch (error: unknown) {
    throw new Error(
      `Error hashing password: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function verifyPassword(
  storedHash: string,
  providedPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, providedPassword);
  } catch (error) {
    throw new Error(
      `Error hashing password: ${error})
      }`,
    );
  }
}

// Test

// const testHashing = await hashPassword("blubber");
// console.log(testHashing);
//
// const testVerify = await verifyPassword(testHashing, "blubber");
// console.log(testVerify);

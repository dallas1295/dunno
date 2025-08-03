import "dotenv/config";
import { createClient, RedisClientType } from "redis";

export interface RateLimitInfo {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

let client: RedisClientType | null = null;
let isConnected = false;

export class RedisManager {
  private static async ensureConnected() {
    if (!client) {
      client = createClient({ url: redisUrl });
    }
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }
  }

  public static async getClient(): Promise<RedisClientType> {
    await this.ensureConnected();
    return client!;
  }

  public static async ping(): Promise<boolean> {
    try {
      const c = await this.getClient();
      const reply = await c.ping();
      return reply === "PONG";
    } catch (error) {
      console.error("Redis ping failed:", error);
      return false;
    }
  }

  public static async del(key: string): Promise<boolean> {
    try {
      const c = await this.getClient();
      const reply = await c.del(key);
      return reply === 1;
    } catch (error) {
      console.error(`Redis DEL failed for key ${key}:`, error);
      return false;
    }
  }

  public static async keys(pattern: string): Promise<string[]> {
    try {
      const c = await this.getClient();
      const reply = await c.keys(pattern);
      return Array.isArray(reply) ? (reply as string[]) : [];
    } catch (error) {
      console.error(`Redis KEYS failed for pattern ${pattern}:`, error);
      return [];
    }
  }

  public static async setex(
    key: string,
    seconds: number,
    value: string,
  ): Promise<boolean> {
    try {
      const c = await this.getClient();
      const reply = await c.setEx(key, seconds, value);
      return reply === "OK";
    } catch (error) {
      console.error(`Redis SETEX failed for key ${key}:`, error);
      return false;
    }
  }

  public static async getRateLimit(key: string): Promise<RateLimitInfo | null> {
    try {
      const c = await this.getClient();
      const reply = await c.get(key);
      return reply ? (JSON.parse(reply) as RateLimitInfo) : null;
    } catch (error) {
      console.error(`Redis GET failed for rate limit key ${key}:`, error);
      return null;
    }
  }

  public static async setRateLimit(
    key: string,
    info: RateLimitInfo,
    seconds: number,
  ): Promise<boolean> {
    try {
      const c = await this.getClient();
      const reply = await c.setEx(key, seconds, JSON.stringify(info));
      return reply === "OK";
    } catch (error) {
      console.error(`Redis SETEX failed for rate limit key ${key}:`, error);
      return false;
    }
  }
}

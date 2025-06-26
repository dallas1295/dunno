import "dotenv/config";
import { createClient, RedisClientType } from "redis";

// 1. Define your RateLimitInfo interface
export interface RateLimitInfo {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
}

// 2. Ensure REDIS_URL is defined
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

// 3. Create and type the client
const client: RedisClientType = createClient({
  url: redisUrl,
});

await client.connect();

export class RedisManager {
  private static client: RedisClientType = client;

  public static async getClient(): Promise<RedisClientType> {
    return this.client;
  }

  public static async ping(): Promise<boolean> {
    try {
      const reply = await this.client.ping();
      return reply === "PONG";
    } catch (error) {
      console.error("Redis ping failed:", error);
      return false;
    }
  }

  public static async del(key: string): Promise<boolean> {
    try {
      const reply = await this.client.del(key);
      return reply === 1;
    } catch (error) {
      console.error(`Redis DEL failed for key ${key}:`, error);
      return false;
    }
  }

  public static async keys(pattern: string): Promise<string[]> {
    try {
      const reply = await this.client.keys(pattern);
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
      const reply = await this.client.setEx(key, seconds, value);
      return reply === "OK";
    } catch (error) {
      console.error(`Redis SETEX failed for key ${key}:`, error);
      return false;
    }
  }

  public static async getRateLimit(key: string): Promise<RateLimitInfo | null> {
    try {
      const reply = await this.client.get(key);
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
      const reply = await this.client.setEx(key, seconds, JSON.stringify(info));
      return reply === "OK";
    } catch (error) {
      console.error(`Redis SETEX failed for rate limit key ${key}:`, error);
      return false;
    }
  }
}

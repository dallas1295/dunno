import { MongoClient, MongoClientOptions } from "mongodb";
import "dotenv/config";

export interface DbConfig {
  uri: string;
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  dbName: string;
}

export const dbConfig: DbConfig = {
  uri: `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@localhost:27017/${process.env.MONGO_DB}?authSource=admin`,
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "10"),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || "1"),
  maxIdleTimeMS: parseInt(process.env.MONGO_MAX_CONN_IDLE_TIME || "60") * 1000,
  dbName: process.env.MONGO_DB || "test",
};

let client: MongoClient | null = null;

export const connectToDb = async (): Promise<MongoClient> => {
  if (client) {
    console.log("Reusing existing MongoDB client instance");
    return client;
  }
  console.log("Creating new MongoDB client instance");
  const options: MongoClientOptions = {
    maxPoolSize: dbConfig.maxPoolSize,
    minPoolSize: dbConfig.minPoolSize,
    maxIdleTimeMS: dbConfig.maxIdleTimeMS,
  };
  client = new MongoClient(dbConfig.uri, options);

  try {
    await client.connect();
    console.log("Connected to the database");
    return client;
  } catch (error) {
    console.error("Something went wrong connecting: ", error);
    client = null;
    throw new Error("Failed to connect to the database");
  }
};

export const closeDatabaseConnection = async (): Promise<void> => {
  if (client) {
    console.log("Closing MongoDB connection");
    try {
      await client.close();
      client = null;
      console.log("MongoDB connection closed");
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
    }
  } else {
    console.log("No MongoDB client to close");
  }
};

export async function ensureIndexes() {
  const client = await connectToDb();
  await client.db(dbConfig.dbName).collection("notes").createIndex({
    noteName: "text",
    content: "text",
  });
}

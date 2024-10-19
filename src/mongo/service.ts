import "jsr:@std/dotenv/load";
import { type Document, type Filter, MongoClient } from "mongodb";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export class ParseError extends Error {
  constructor(public override cause: z.ZodError) {
    super("Failed to parse the result");
  }
}

export class MongoService {
  client: MongoClient;

  constructor() {
    const connectionString = Deno.env.get("MONGO_CONNECTION_STRING");

    if (!connectionString) {
      throw new Error("MONGO_CONNECTION_STRING is not set");
    }
    this.client = new MongoClient(connectionString);
  }

  async aggregate<T extends Document>(
    collection: string,
    pipeline: Record<string, unknown>[],
    schema: z.ZodSchema<T>,
  ): Promise<Result<T[], Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db
        .collection(collection)
        .aggregate(pipeline)
        .toArray();
      return result;
    });

    if (result.isErr()) return err(result.error);

    const parsed = z.array(schema).safeParse(result.value);
    if (!parsed.success) return err(new ParseError(parsed.error));

    return ok(parsed.data);
  }

  async insertOne<T extends Document>(
    collection: string,
    document: T,
  ): Promise<Result<string, Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).insertOne(document);
      return result;
    });

    if (result.isErr()) return err(result.error);

    const id = result.value.insertedId.toString();

    if (!id || typeof id !== "string") {
      return err(new Error("failed to return the id"));
    }

    return ok(id);
  }

  async getOne<T extends Document>(
    collection: string,
    query: Record<string, unknown>,
    schema: z.ZodSchema<T>,
  ): Promise<Result<T, Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).findOne(query);
      return result;
    });

    if (result.isErr()) return err(result.error);

    if (!result.value) {
      return err(new Deno.errors.NotFound("Document not found"));
    }

    const value = MongoService.transformId(result.value);

    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return err(new ParseError(parsed.error));
    }

    return ok(parsed.data);
  }

  async getMany<T extends Document>(
    collection: string,
    schema: z.ZodSchema<T>,
    query: Filter<Document> = {},
  ): Promise<Result<T[], Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).find(query).toArray();
      return result;
    });

    if (result.isErr()) return err(result.error);

    const parsed = z
      .array(schema)
      .safeParse(result.value.map(MongoService.transformId));
    if (!parsed.success) return err(new ParseError(parsed.error));

    return ok(parsed.data);
  }

  async removeCollection(collection: string): Promise<Result<void, Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).drop();
      return result;
    });

    if (result.isErr()) return err(result.error);
    return ok(undefined);
  }

  private static transformId<T extends Document>(document: T) {
    const result = "_id" in document
      ? { ...document, id: document._id.toString() }
      : document;

    delete result._id;
    return result;
  }

  private withConnection = async <T>(
    fn: (client: MongoClient) => Promise<T>,
  ) => {
    try {
      await this.client.connect();
      const result = await fn(this.client);
      return ok(result);
    } catch (error) {
      if (error instanceof Error) {
        return err(error);
      }
      return err(new Error("An unknown error occurred"));
    } finally {
      await this.client.close();
    }
  };
}

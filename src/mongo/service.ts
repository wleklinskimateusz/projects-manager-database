import "jsr:@std/dotenv/load";
import {
  type Document,
  type Filter,
  type MatchKeysAndValues,
  MongoClient,
  MongoError,
} from "mongodb";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { WrongId } from "@projects-manager/core";

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

  static getIdFromString(id: string): Result<ObjectId, WrongId> {
    try {
      return ok(new ObjectId(id));
    } catch (e) {
      return err(new WrongId(e));
    }
  }

  static generateId(): string {
    return new ObjectId().toString();
  }

  async aggregate<T extends Document>(
    collection: string,
    pipeline: Record<string, unknown>[],
    schema: z.ZodSchema<T>,
  ): Promise<Result<T[], MongoError | ParseError>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db
        .collection(collection)
        .aggregate(pipeline)
        .toArray();
      return ok(result);
    });

    if (result.isErr()) return err(result.error);

    const parsed = z.array(schema).safeParse(result.value);
    if (!parsed.success) return err(new ParseError(parsed.error));

    return ok(parsed.data);
  }

  async insertOne<T extends Document>(
    collection: string,
    document: T,
  ): Promise<Result<string, MongoError>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).insertOne({ ...document });
      return ok(result);
    });

    if (result.isErr()) return err(result.error);

    const id = result.value.insertedId.toString();

    if (!id || typeof id !== "string") {
      return err(new MongoError("failed to return the id"));
    }

    return ok(id);
  }

  async getOne<T extends Document, TResult>(
    collection: string,
    query: Filter<T>,
    schema: z.ZodSchema<TResult>,
  ): Promise<Result<TResult, MongoError | ParseError | Deno.errors.NotFound>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).findOne(
        query as Filter<Document>,
      );
      return ok(result);
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
  ): Promise<Result<T[], MongoError | ParseError>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).find(query).toArray();
      return ok(result);
    });

    if (result.isErr()) return err(result.error);

    const parsed = z
      .array(schema)
      .safeParse(result.value.map(MongoService.transformId));
    if (!parsed.success) return err(new ParseError(parsed.error));

    return ok(parsed.data);
  }

  async update<T extends Document>(
    collection: string,
    update: MatchKeysAndValues<T>,
    query: Filter<T> = {},
  ): Promise<Result<void, Deno.errors.NotFound | MongoError | WrongId>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).updateOne(
        query as Filter<Document>,
        { $set: update },
      );

      if (result.matchedCount === 0) {
        return err(new Deno.errors.NotFound("Document not found"));
      }

      return ok(result);
    });

    if (result.isErr()) return err(result.error);
    return ok(undefined);
  }

  async delete<T extends Document>(
    collection: string,
    query: Filter<T>,
  ): Promise<Result<void, Deno.errors.NotFound | MongoError | WrongId>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).deleteOne(
        query as Filter<Document>,
      );

      if (result.deletedCount === 0) {
        return err(new Deno.errors.NotFound("Document not found"));
      }

      return ok(result);
    });

    if (result.isErr()) return err(result.error);
    return ok(undefined);
  }

  async removeCollection(collection: string): Promise<Result<void, Error>> {
    const result = await this.withConnection(async (client) => {
      const db = client.db();
      const result = await db.collection(collection).drop();
      return ok(result);
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

  private withConnection = async <T, TError extends Error>(
    fn: (client: MongoClient) => Promise<Result<T, TError>>,
  ) => {
    try {
      await this.client.connect();
      const result = await fn(this.client);
      if (result.isErr()) {
        return err(result.error);
      }
      return ok(result.value);
    } catch (error) {
      if (error instanceof MongoError) {
        return err(error);
      }
      if (error instanceof Error) {
        const newError = new MongoError(error.message);
        newError.cause = error;
        return err(newError);
      }
      return err(new MongoError("An unknown error occurred"));
    } finally {
      await this.client.close();
    }
  };
}

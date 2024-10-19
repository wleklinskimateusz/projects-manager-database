import { afterEach, describe, it } from "@std/testing/bdd";
import { MongoService } from "./service.ts";
import { expect } from "jsr:@std/expect/expect";
import { z } from "zod";

describe("MongoService", () => {
  const service = new MongoService();
  afterEach(async () => {
    await service.removeCollection("test");
  });

  it("should be able to create a new entry", async () => {
    const insertResult = await service.insertOne("test", { name: "Test" });
    if (insertResult.isErr()) {
      throw new Error("Failed to insert the entry");
    }

    expect(insertResult.value).toMatch(/^[0-9a-f]{24}$/);

    const getOneResult = await service.getOne(
      "test",
      { name: "Test" },
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    );

    if (getOneResult.isErr()) {
      throw new Error("Failed to get the entry");
    }

    expect(getOneResult.value).toMatchObject({ name: "Test" });
  });

  it("should be able to getMany", async () => {
    await service.insertOne("test", { name: "Test" });
    await service.insertOne("test", { name: "another test" });

    const getManyResult = await service.getMany(
      "test",
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    );

    if (getManyResult.isErr()) {
      throw new Error("Failed to get the entries");
    }

    expect(getManyResult.value).toEqual([
      { name: "Test", id: expect.any(String) },
      { name: "another test", id: expect.any(String) },
    ]);
  });

  it("should be able to aggregate data", async () => {
    await service.insertOne("test", { name: "Test" });

    const result = await service.aggregate(
      "test",
      [{ $match: { name: "Test" } }],
      z.object({
        name: z.string(),
      }),
    );

    if (result.isErr()) {
      throw new Error("Failed to aggregate data");
    }

    expect(result.value).toEqual([{ name: "Test" }]);
  });

  it("should be able to remove a collection", async () => {
    const insertResult = await service.insertOne("test", { name: "Test" });
    expect(insertResult.isOk()).toBe(true);

    const removeResult = await service.removeCollection("test");

    expect(removeResult.isOk()).toBe(true);

    const getOneResult = await service.getOne(
      "test",
      { name: "Test" },
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    );

    if (getOneResult.isOk()) {
      throw new Error("Failed to remove the collection");
    }
    expect(getOneResult.error).toBeInstanceOf(Deno.errors.NotFound);
  });
});

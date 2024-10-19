import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { ProjectRepository } from "./project.ts";
import { MongoService } from "../mongo/service.ts";
import { ObjectId } from "mongodb";
import type { ProjectId } from "@projects-manager/core";

describe("ProjectRepository", () => {
  const mongoService = new MongoService();
  const respository = new ProjectRepository(mongoService);

  const insertProject = async (name: string) => {
    const result = await respository.create({
      name,
      description: "Description",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return result._unsafeUnwrap();
  };

  afterEach(async () => {
    await mongoService.removeCollection("projects");
  });

  it("should be able to create a project", async () => {
    const result = await respository.create({
      name: "Project",
      description: "Description",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.isOk()).toBe(true);
  });

  describe("getAll", () => {
    it("should return an empty array if no projects exist", async () => {
      const result = await respository.getAll();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(0);
    });

    it("should be able to get list of projects when one is inserted", async () => {
      await insertProject("Project");

      const result = await respository.getAll();
      if (!result.isOk()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(1);
      expect(result.value[0].name).toBe("Project");
    });

    it("should be able to get list of projects when multiple are inserted", async () => {
      await insertProject("Project 1");

      await insertProject("Project 2");

      const result = await respository.getAll();
      if (!result.isOk()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(2);
      expect(result.value[0].name).toBe("Project 1");
      expect(result.value[1].name).toBe("Project 2");
    });
  });

  it("should be able to get a project by id", async () => {
    const name = "Some name";
    await insertProject(name);

    const [project] = await respository.getAll().then((result) =>
      result._unsafeUnwrap()
    );

    const result = await respository.getById(project.id);
    if (!result.isOk()) {
      throw result.error;
    }

    expect(result.value.name).toBe(name);
  });

  it("for two projects should be able to get a project by id", async () => {
    const name = "Some name";
    await insertProject("Another name");
    await insertProject(name);

    const projects = await respository.getAll().then((result) =>
      result._unsafeUnwrap()
    );

    const project = projects.find((project) => project.name === name);
    if (!project) {
      throw new Error("Failed to find the project");
    }

    const result = await respository.getById(project.id);
    if (!result.isOk()) {
      throw result.error;
    }

    expect(result.value.name).toBe(name);
  });

  it("should return an error if the project does not exist", async () => {
    const result = await respository.getById(
      new ObjectId().toString() as ProjectId,
    );

    if (result.isOk()) {
      throw new Error("Expected an error");
    }

    expect(result.error).toBeInstanceOf(Deno.errors.NotFound);
  });
});

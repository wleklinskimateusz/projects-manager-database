import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { ProjectRepository } from "./project.ts";
import { MongoService } from "../mongo/service.ts";
import type { Project, ProjectId, UserId } from "@projects-manager/core";

describe("ProjectRepository", () => {
  const mongoService = new MongoService();
  const respository = new ProjectRepository(mongoService);

  const insertProject = async (name: string, user: UserId) => {
    const result = await respository.create({
      name,
      description: "Description",
      createdAt: new Date(),
      updatedAt: new Date(),
    }, user);
    if (result.isErr()) {
      throw result.error;
    }
    return result.value;
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
    }, MongoService.generateId() as UserId);
    expect(result.isOk()).toBe(true);
  });

  describe("getAll", () => {
    it("should return an empty array if no projects exist", async () => {
      const result = await respository.getAll(
        MongoService.generateId() as UserId,
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(0);
    });

    it("should return an empty array if there are projects but not for the user", async () => {
      await insertProject("Project", MongoService.generateId() as UserId);

      const result = await respository.getAll(
        MongoService.generateId() as UserId,
      );

      if (result.isErr()) {
        throw result.error;
      }

      expect(result.value.length).toBe(0);
    });

    it("for two projects should return only the projects for the user", async () => {
      const userId = MongoService.generateId() as UserId;
      await insertProject("Project 1", userId);

      await insertProject("Project 2", MongoService.generateId() as UserId);

      const result = await respository.getAll(userId);
      if (!result.isOk()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(1);
      expect(result.value[0].name).toBe("Project 1");
    });

    it("should be able to get list of projects when one is inserted", async () => {
      const userId = MongoService.generateId() as UserId;
      await insertProject("Project", userId);

      const result = await respository.getAll(userId);
      if (!result.isOk()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(1);
      expect(result.value[0].name).toBe("Project");
    });

    it("should be able to get list of projects when multiple are inserted", async () => {
      const userId = MongoService.generateId() as UserId;
      await insertProject("Project 1", userId);

      await insertProject("Project 2", userId);

      const result = await respository.getAll(userId);
      if (!result.isOk()) {
        throw new Error("Failed to get all projects");
      }

      expect(result.value.length).toBe(2);
      expect(result.value[0].name).toBe("Project 1");
      expect(result.value[1].name).toBe("Project 2");
    });
  });

  describe("getById", () => {
    it("should be able to get a project by id", async () => {
      const name = "Some name";
      const userId = MongoService.generateId() as UserId;
      const projectId = await insertProject(name, userId);

      const result = await respository.getById(projectId, userId);
      if (!result.isOk()) {
        throw result.error;
      }

      expect(result.value.name).toBe(name);
    });

    it("for two projects should be able to get a project by id", async () => {
      const name = "Some name";
      const userId = MongoService.generateId() as UserId;
      await insertProject("Another name", userId);
      const projectId = await insertProject(name, userId);

      const result = await respository.getById(projectId, userId);
      if (!result.isOk()) {
        throw result.error;
      }

      expect(result.value.name).toBe(name);
    });

    it("should return an error if the project does not exist", async () => {
      const result = await respository.getById(
        MongoService.generateId() as ProjectId,
        MongoService.generateId() as UserId,
      );

      if (result.isOk()) {
        throw new Error("Expected an error");
      }

      expect(result.error).toBeInstanceOf(Deno.errors.NotFound);
    });

    it("should return an error if the project does not exist for the user", async () => {
      const projectId = await insertProject(
        "Project",
        MongoService.generateId() as UserId,
      );

      const result = await respository.getById(
        projectId,
        MongoService.generateId() as UserId,
      );

      if (result.isOk()) {
        throw new Error("Expected an error");
      }

      expect(result.error).toBeInstanceOf(Deno.errors.NotFound);
    });
  });

  describe("update", () => {
    it("should be able to update a project", async () => {
      const userId = MongoService.generateId() as UserId;
      const projectId = await insertProject("Project", userId);
      const updateName = "Updated";

      const newProject = {
        id: projectId,
        name: updateName,
        description: "Description",
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies Project;

      await respository.update(newProject);

      const result = await respository.getById(projectId, userId);
      if (!result.isOk()) {
        throw result.error;
      }

      expect(result.value.name).toBe(updateName);
    });

    it("should return an error if the project does not exist", async () => {
      const result = await respository.update({
        id: MongoService.generateId() as ProjectId,
        name: "Updated",
        description: "Description",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (result.isOk()) {
        throw new Error("Expected an error");
      }

      expect(result.error).toBeInstanceOf(Deno.errors.NotFound);
    });
  });

  describe("delete", () => {
    it("should be able to delete a project", async () => {
      const userId = MongoService.generateId() as UserId;
      const projectId = await insertProject("Project", userId);

      const deleteResult = await respository.delete(projectId);
      if (!deleteResult.isOk()) {
        throw deleteResult.error;
      }

      const getResult = await respository.getById(projectId, userId);
      if (getResult.isOk()) {
        throw new Error("Expected an error");
      }

      expect(getResult.error).toBeInstanceOf(Deno.errors.NotFound);
    });
  });
});

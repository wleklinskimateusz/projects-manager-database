import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { ProjectRepository } from "./project.ts";
import { MongoService } from "../mongo/service.ts";

describe("ProjectRepository", () => {
  const mongoService = new MongoService();
  it("should be able to create a project", async () => {
    const respository = new ProjectRepository(mongoService);
    const result = await respository.create({
      id: "1",
      name: "Project",
      description: "Description",
    });
    expect(result.isOk()).toBe(true);
  });

  it("shouldn't be able to create a project with the same id", async () => {
    const respository = new ProjectRepository(mongoService);
    respository.create({
      id: "1",
      name: "Project",
      description: "Description",
    });
    const result = await respository.create({
      id: "1",
      name: "Project",
      description: "Description",
    });
    expect(result.isErr()).toBe(true);
  });
});

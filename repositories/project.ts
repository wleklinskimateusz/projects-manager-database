import {
  type Project,
  ProjectConnector,
  type ProjectId,
  type UserId,
} from "@projects-manager/core";
import { ok, type Result } from "neverthrow";
import type { MongoService } from "../mongo/service.ts";

export class ProjectRepository extends ProjectConnector {
  constructor(private mongoService: MongoService) {
    super();
  }
  getAll(): Promise<Result<Project[], Error>> {
    return Promise.resolve(ok([]));
  }
  getById(_id: ProjectId): Promise<Result<Project, Error>> {
    return Promise.resolve(ok({
      id: "1" as UserId,
      name: "Project",
      description: "Description",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }
  create(project: Project): Promise<Result<void, Error>> {
    return this.mongoService.insertOne("projects", project);
  }
  update(_project: Project): Promise<Result<void, Error>> {
    return Promise.resolve(ok(undefined));
  }
  delete(_id: Project["id"]): Promise<Result<void, Error>> {
    return Promise.resolve(ok(undefined));
  }
}

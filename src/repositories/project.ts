import {
  type Project,
  ProjectConnector,
  type ProjectId,
  type UserId,
} from "@projects-manager/core";
import { ok, type Result } from "neverthrow";
import { MongoService } from "../mongo/service.ts";
import { z } from "zod";
import { err } from "neverthrow";
import { ObjectId } from "mongodb";

const schema = z.object({
  id: z.string().brand("ProjectId"),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class ProjectRepository extends ProjectConnector {
  constructor(private mongoService: MongoService) {
    super();
  }
  async getAll(userId: UserId): Promise<Result<Project[], Error>> {
    const result = await this.mongoService.getMany(
      "projects",
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
      { userId: MongoService.getIdFromString(userId) },
    );

    if (result.isErr()) {
      return err(result.error);
    }

    return result.map((projects) =>
      projects.map(({ id, ...project }) => ({
        id: id as ProjectId,
        ...project,
      }))
    );
  }

  async getById(id: ProjectId, user: UserId): Promise<Result<Project, Error>> {
    const result = await this.mongoService.getOne(
      "projects",
      {
        _id: MongoService.getIdFromString(id),
        userId: MongoService.getIdFromString(user),
      },
      schema,
    );
    if (result.isErr()) {
      return err(result.error);
    }

    const project = result.value;

    return ok({
      ...project,
      id,
    });
  }

  async create(
    project: Omit<Project, "id">,
    userId: UserId,
  ): ReturnType<ProjectConnector["create"]> {
    const result = await this.mongoService.insertOne("projects", {
      ...project,
      userId: MongoService.getIdFromString(userId),
    });
    return result.map((id) => id as ProjectId);
  }

  update(_project: Project): Promise<Result<void, Error>> {
    return Promise.resolve(ok(undefined));
  }
  delete(_id: Project["id"]): Promise<Result<void, Error>> {
    return Promise.resolve(ok(undefined));
  }
}

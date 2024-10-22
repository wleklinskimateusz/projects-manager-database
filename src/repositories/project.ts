import {
  type Project,
  ProjectConnector,
  type ProjectId,
  type UserId,
  type WrongId,
} from "@projects-manager/core";
import { ok, type Result } from "neverthrow";
import { MongoService } from "../mongo/service.ts";
import { z } from "zod";
import { err } from "neverthrow";
import type { MongoError, ObjectId } from "mongodb";

const schema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type MongoProject = Omit<z.infer<typeof schema>, "id"> & {
  userId: ObjectId;
  _id: ObjectId;
};

export class ProjectRepository extends ProjectConnector {
  constructor(private mongoService: MongoService) {
    super();
  }
  async getAll(userId: UserId): Promise<Result<Project[], Error>> {
    const userIdResult = MongoService.getIdFromString(userId);
    if (userIdResult.isErr()) {
      return err(userIdResult.error);
    }
    const result = await this.mongoService.getMany(
      "projects",
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
      { userId: userIdResult.value },
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
    const userIdResult = MongoService.getIdFromString(user);
    if (userIdResult.isErr()) {
      return err(userIdResult.error);
    }

    const projectIdResult = MongoService.getIdFromString(id);
    if (projectIdResult.isErr()) {
      return err(projectIdResult.error);
    }

    const result = await this.mongoService.getOne<
      MongoProject,
      z.infer<typeof schema>
    >(
      "projects",
      {
        _id: projectIdResult.value,
        userId: userIdResult.value,
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
    const userIdResult = MongoService.getIdFromString(userId);
    if (userIdResult.isErr()) {
      return err(userIdResult.error);
    }
    const result = await this.mongoService.insertOne("projects", {
      ...project,
      userId: userIdResult.value,
    });
    return result.map((id) => id as ProjectId);
  }

  update(
    project: Project,
  ): Promise<Result<void, Deno.errors.NotFound | MongoError | WrongId>> {
    const idResult = MongoService.getIdFromString(project.id);
    if (idResult.isErr()) {
      return Promise.resolve(err(idResult.error));
    }
    return this.mongoService.update("projects", project, {
      _id: idResult.value,
    });
  }

  delete(
    id: Project["id"],
  ): Promise<Result<void, Deno.errors.NotFound | MongoError | WrongId>> {
    const idResult = MongoService.getIdFromString(id);
    if (idResult.isErr()) {
      return Promise.resolve(err(idResult.error));
    }
    return this.mongoService.delete("projects", {
      _id: idResult.value,
    });
  }
}

import { connectToDb } from "./database";
import { UserRepo } from "@/repositories/user";
import { NoteRepo } from "@/repositories/note";
import { TodoRepo } from "@/repositories/todo";
import { UserService } from "@/services/user";
import { NoteService } from "@/services/note";
import { TodoService } from "@/services/todo";

let userService: UserService | null = null;
let noteService: NoteService | null = null;
let todoService: TodoService | null = null;

export async function getUserService(): Promise<UserService> {
  if (!userService) {
    const dbClient = await connectToDb();
    const userRepo = new UserRepo(dbClient);
    userService = new UserService(userRepo);
  }
  return userService;
}

export async function getNoteService(): Promise<NoteService> {
  if (!noteService) {
    const dbClient = await connectToDb();
    const noteRepo = new NoteRepo(dbClient);
    noteService = new NoteService(noteRepo);
  }
  return noteService;
}

export async function getTodoService(): Promise<TodoService> {
  if (!todoService) {
    const dbClient = await connectToDb();
    const todoRepo = new TodoRepo(dbClient);
    todoService = new TodoService(todoRepo);
  }
  return todoService;
}

import { Collection, MongoClient } from "mongodb";
import { Todo } from "@/models/todo";
import { DatabaseMetrics, ErrorCounter } from "@/utils/otel";
import "dotenv/config";

export class TodoRepo {
  private collection: Collection<Todo>;

  constructor(db: MongoClient) {
    const dbName = process.env.MONGO_DB as string;
    const colName = process.env.TODO_COLLECTION as string;
    this.collection = db.db(dbName).collection(colName);
  }

  async createTodo(todo: Todo): Promise<Todo> {
    const timer = DatabaseMetrics.track("insert", "todo");

    try {
      if (!todo.todoName || todo.todoName.trim() === "") {
        throw new Error("Todo requires name");
      }

      await this.collection.insertOne(todo);

      return todo; //UUID set in service before being sent to repository
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "create_todo_failed",
      });
      console.log("Failed to create todo");
      throw error;
    } finally {
      timer.end();
    }
  }

  async getUserTodos(userId: string): Promise<Todo[] | null> {
    const timer = DatabaseMetrics.track("find", "todo");

    try {
      const findUserTodos = this.collection.find({ userId: userId });
      const userTodos: Todo[] = await findUserTodos.toArray();

      return userTodos;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "get_user_todos_failed",
      });
      console.log("failed to fetch user todos");
      throw error;
    } finally {
      timer.end();
    }
  }

  async getTodoById(todoId: string): Promise<Todo | null> {
    const timer = DatabaseMetrics.track("find", "todo");

    try {
      const findUserTodo = this.collection.findOne({
        todoId: todoId,
      });

      const userTodo = await findUserTodo;

      return userTodo;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "get_todo_by_id_failed",
      });
      console.log("failed to fetch user todo by id");
      throw error;
    } finally {
      timer.end();
    }
  }

  async updateTodo(
    userId: string,
    todoId: string,
    updates: Partial<Todo>,
  ): Promise<void> {
    const timer = DatabaseMetrics.track("update", "todo");
    try {
      const filter = {
        userId: userId,
        todoId: todoId,
      };

      const update = {
        $set: {
          todoName: updates.todoName,
          description: updates.description,
          updatedAt: new Date(),
          tags: updates.tags,
          priorityLevel: updates.priority,
          dueDate: updates.dueDate,
          reminderAt: updates.reminderAt,
          recurrencePattern: updates.recurringPattern,
          isComplete: updates.isComplete,
        },
      };
      const result = await this.collection.updateOne(filter, update);

      if (result.matchedCount === 0) {
        ErrorCounter.add(1, {
          type: "database",
          operation: "todo_not_found",
        });
        throw new Error("Todo not found");
      }
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "todo_update_failed",
      });
      console.log("failed to update todo");
      throw error;
    } finally {
      timer.end();
    }
  }

  async deleteTodo(userId: string, todoId: string): Promise<void> {
    const timer = DatabaseMetrics.track("delete", "todo");

    try {
      const filter = {
        userId: userId,
        todoId: todoId,
      };
      const result = await this.collection.deleteOne(filter);

      if (result.deletedCount === 0) {
        ErrorCounter.add(1, {
          type: "database",
          operation: "todo_not_found",
        });
        throw new Error("Todo not found");
      }
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "delete_todo_failed",
      });
      console.log("failed to delete todo");
      throw error;
    } finally {
      timer.end();
    }
  }

  async countUserTodos(userId: string): Promise<number> {
    const timer = DatabaseMetrics.track("count", "todo");

    try {
      const count = await this.collection.countDocuments({ userId: userId });

      return count;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "count_user_todos_failed",
      });
      throw error;
    } finally {
      timer.end();
    }
  }

  async findTodos(
    userId: string,
    {
      tags,
      sortBy = "createdAt",
      sortOrder = -1,
    }: {
      tags?: string[];
      sortBy?: string;
      sortOrder?: 1 | -1;
    },
  ): Promise<Todo[]> {
    const timer = DatabaseMetrics.track("find", "todo");
    try {
      const filter: Record<string, unknown> = { userId };
      if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
      }
      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortOrder;
      const todos = await this.collection.find(filter).sort(sort).toArray();
      return todos;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "database",
        operation: "find_todos_failed",
      });
      throw error;
    } finally {
      timer.end();
    }
  }
}

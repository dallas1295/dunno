import { Pattern, Priority, Todo } from "@/models/todo";

interface TodoLink {
  href: string;
  method?: string;
}



interface TodoResponse {
  todoId: string;
  todoName: string;
  description: string;
  isComplete: boolean;
  priority?: keyof typeof Priority;
  tags?: string[];
  dueDate?: Date;
  reminderAt?: Date;
  isRecurring?: boolean;
  recurringPattern?: keyof typeof Pattern;
  recurrenceEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
  timeUntilDue?: string;
  links: { [key: string]: TodoLink };
}

export function toTodoResponse(
  todo: Todo,
  links: { [key: string]: TodoLink },
): TodoResponse {
  const response: TodoResponse = {
    todoId: todo.todoId,
    todoName: todo.todoName,
    description: todo.description,
    isComplete: todo.isComplete,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    links: links,
  };

  if (todo.priority) {
    response.priority = todo.priority;
  }

  if (todo.dueDate) {
    response.dueDate = todo.dueDate;
  }

  if (todo.tags) {
    response.tags = todo.tags;
  }

  if (todo.isRecurring) {
    response.isRecurring = todo.isRecurring;
    response.recurringPattern = todo.recurringPattern;
    if (todo.recurrenceEnd) {
      response.recurrenceEnd = todo.recurrenceEnd;
    }
  }

  if (todo.dueDate) {
    response.dueDate = todo.dueDate;

    if (!todo.isComplete) {
      const now = new Date();

      if (todo.dueDate < now) {
        response.timeUntilDue = "Overdue";
      } else {
        const timeUntilDue = Math.round(
          (todo.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60),
        );

        response.timeUntilDue = `${timeUntilDue} hours`;
      }
    }
  }

  return response;
}

export function toManyTodoResponses(
  todos: Todo[],
  getTodoLinks: (todo: Todo) => { [key: string]: TodoLink },
): TodoResponse[] {
  return todos.map((todo) => toTodoResponse(todo, getTodoLinks(todo)));
}

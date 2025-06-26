import { Pattern, Priority, Todo } from "@/models/todo";

export function validateTags(tags?: string[]): string[] {
  if (!tags || tags.length === 0 || tags.length === 0) {
    return [];
  }

  const validTags = tags.map((tag) => tag.trim()).filter((tag) => tag !== "");

  if (validTags.length > 5) {
    throw new Error("cannot exceed 5 tags per todo");
  }

  for (const tag of validTags) {
    if (tag.length > 20) {
      throw new Error("tag cannot exceed 20 characters");
    }
  }

  return validTags;
}

export function validatePriority(
  priority?: keyof typeof Priority,
): keyof typeof Priority | undefined {
  if (!priority) return undefined;

  if (Object.keys(Priority).includes(priority)) {
    return priority;
  }

  return undefined;
}

export function validateRecurringPattern(
  pattern?: keyof typeof Pattern,
): keyof typeof Pattern | undefined {
  if (!pattern) return undefined;

  if (Object.values(Pattern).includes(pattern)) {
    return pattern;
  }

  return undefined;
}

export function isTodoValid(todo: Todo): boolean {
  if (!todo.userId) return false;

  const todoName = todo.todoName?.trim() ?? "";
  if (!todoName || todoName.length < 1 || todoName.length > 100) return false;

  const now = new Date();
  if (todo.dueDate && todo.dueDate < now) return false;
  if (todo.reminderAt && todo.reminderAt < now) return false;
  if (todo.reminderAt && todo.dueDate && todo.reminderAt > todo.dueDate) {
    return false;
  }

  return true;
}

export function validateProperties(
  tags: string[],
  priority?: keyof typeof Priority,
  isRecurring?: boolean,
  recurringPattern?: keyof typeof Pattern,
): {
  validTags: string[];
  validPriority: keyof typeof Priority | undefined;
  validPattern?: keyof typeof Pattern;
} {
  let validTags: string[];
  let validPattern: keyof typeof Pattern | undefined;

  try {
    validTags = validateTags(tags);
  } catch (error) {
    throw new Error(`${error}`);
  }

  if (isRecurring) {
    try {
      validPattern = validateRecurringPattern(recurringPattern);
    } catch (error) {
      throw new Error(`Recurring pattern validation failed: ${error}`);
    }
  }

  const validPriority = validatePriority(priority);

  return { validTags, validPriority, validPattern };
}

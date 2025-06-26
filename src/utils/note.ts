import { Note } from "@/models/note";

export function isNoteValid(note: Note): boolean {
  const noteName = note.noteName?.trim() ?? "";
  if (!noteName) false;
  if (noteName.length < 1 || noteName.length > 100) false;

  const content = note.content?.trim() ?? "";
  if (!content) return false;
  if (content.length < 1) {
    console.warn("no content");
    return false;
  }
  if (content.length > 10000) {
    console.warn("content too long");
    return false;
  }

  if (note.tags?.length) {
    const normalizedTags: string[] = note.tags
      .filter((tag): tag is string => tag !== undefined)
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");

    note.tags = normalizedTags;

    if (normalizedTags.length > 10) {
      console.warn("too many tags");
      return false;
    }
  }

  return true;
}

export async function sortNotes(
  notes: Note[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): Promise<Note[]> {
  if (!sortBy) {
    sortBy = "createdAt";
  }
  const sortedNotes = [...notes].sort((a: Note, b: Note) => {
    const aVal = a[sortBy as keyof Note];
    const bVal = b[sortBy as keyof Note];
    if (
      aVal === undefined ||
      bVal === undefined ||
      (aVal === undefined && bVal === undefined)
    ) {
      return 0;
    }
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  return Promise.resolve(sortedNotes);
}

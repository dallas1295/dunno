export interface Note {
  noteId: string;
  userId: string;
  noteName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  isPinned: boolean;
  isArchived: boolean;
  pinnedPosition?: number;
  searchScore?: number;
}

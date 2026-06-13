import { BaseRepository } from "./BaseRepository";

export interface ServerNote {
  id: string;
  student_id: string;
  title?: string;
  content: string;
  class_level?: number;
  subject?: string;
  chapter?: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface NoteFilters {
  class_level?: number;
  subject?: string;
  chapter?: string | number;
}

class NotesRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  list(studentId: string, filters: NoteFilters = {}): Promise<{ notes: ServerNote[] }> {
    const params = new URLSearchParams();
    if (filters.class_level) params.set("class_level", String(filters.class_level));
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.chapter) params.set("chapter", String(filters.chapter));
    const q = params.toString();
    return this.get(`/api/notes/${studentId}${q ? `?${q}` : ""}`);
  }

  create(payload: Partial<ServerNote>): Promise<ServerNote> {
    return this.post(`/api/notes/`, payload);
  }

  update(id: string, payload: Partial<ServerNote>): Promise<ServerNote> {
    return this.patch(`/api/notes/${id}`, payload);
  }

  remove(id: string): Promise<unknown> {
    return this.delete(`/api/notes/${id}`);
  }

  listPdfs(studentId: string): Promise<unknown> {
    return this.get(`/api/notes/${studentId}/pdfs`);
  }
}

export const NotesRepository = new NotesRepositoryImpl();

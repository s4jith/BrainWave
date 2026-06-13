import { BaseRepository } from "./BaseRepository";

export interface CurriculumSubject {
  id: string;
  name: string;
  class_level?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

class CurriculumRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  listSubjects(classLevel?: number): Promise<CurriculumSubject[]> {
    const params = new URLSearchParams();
    params.set("is_active", "true");
    if (classLevel) params.set("class_level", String(classLevel));
    return this.get(`/api/curriculum/subjects?${params.toString()}`);
  }

  getSubject(subjectId: string): Promise<CurriculumSubject | null> {
    return this.get(`/api/curriculum/subjects/${subjectId}`);
  }
}

export const CurriculumRepository = new CurriculumRepositoryImpl();

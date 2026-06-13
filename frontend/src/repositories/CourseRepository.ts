import { BaseRepository } from "./BaseRepository";

export interface CourseListFilters {
  page?: number;
  pageSize?: number;
  category?: string;
  difficulty?: string;
  classLevel?: number;
  instructorId?: string;
  enrolledOnly?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  difficulty?: string;
  class_level?: number;
  instructor_id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CourseListResponse {
  courses: Course[];
  total: number;
  page: number;
  page_size: number;
}

class CourseRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  list(filters: CourseListFilters = {}): Promise<CourseListResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("page_size", String(filters.pageSize));
    if (filters.category) params.set("category", filters.category);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.classLevel) params.set("class_level", String(filters.classLevel));
    if (filters.instructorId) params.set("instructor_id", filters.instructorId);
    if (filters.enrolledOnly) params.set("enrolled_only", "true");
    return this.get(`/api/courses?${params.toString()}`);
  }

  myCourses(): Promise<{ courses: Course[] }> {
    return this.get(`/api/courses/my-courses`);
  }

  detail(courseId: string): Promise<Course> {
    return this.get(`/api/courses/${courseId}`);
  }

  create(payload: Partial<Course>): Promise<Course> {
    return this.post(`/api/courses`, payload);
  }

  update(courseId: string, payload: Partial<Course>): Promise<Course> {
    return this.put(`/api/courses/${courseId}`, payload);
  }

  publish(courseId: string): Promise<Course> {
    return this.post(`/api/courses/${courseId}/publish`);
  }

  addModule(courseId: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.post(`/api/courses/${courseId}/modules`, payload);
  }
}

export const CourseRepository = new CourseRepositoryImpl();

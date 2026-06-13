import { BaseRepository } from "./BaseRepository";

export interface AnnotationRequest {
  selected_text: string;
  action: string;
  class_level: number;
  subject: string;
  chapter: string | number;
  image_data?: string | null;
  page_number?: number | null;
}

export interface AnnotationResponse {
  answer: string;
  action_type?: string;
  source_count?: number;
}

class AnnotationRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  process(payload: AnnotationRequest): Promise<AnnotationResponse> {
    return this.post(`/api/annotation/`, payload);
  }
}

export const AnnotationRepository = new AnnotationRepositoryImpl();

import { AnnotationRepository } from "@repositories/AnnotationRepository";
import type { AnnotationRequest } from "@repositories/AnnotationRepository";

export const AnnotationService = {
  process: (payload: AnnotationRequest) => AnnotationRepository.process(payload),

  /** Convenience wrapper that mirrors the legacy explanation call. */
  explain: (params: {
    text: string;
    mode: string;
    classLevel: number;
    subject: string;
    chapter: string | number;
  }) =>
    AnnotationRepository.process({
      selected_text: params.text,
      action: params.mode,
      class_level: params.classLevel,
      subject: params.subject,
      chapter: params.chapter,
    }),
};

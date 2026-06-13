/**
 * Static academic catalog: subject list, class levels, difficulty buckets,
 * and helpers for the combined "class-subject" select widgets used across
 * admin/teacher pages. The fetch helpers live in `services/CurriculumService`.
 */

export const SUBJECTS = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
  "Hindi",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type ClassLevel = (typeof CLASSES)[number];

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export const QUESTION_TYPES = [
  "mcq",
  "fillup",
  "short_answer",
  "long_answer",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface ClassSubjectOption {
  value: string;
  label: string;
  class: number;
  subject: string;
}

export function getCombinedClassSubjectOptions(): ClassSubjectOption[] {
  const options: ClassSubjectOption[] = [];
  for (const classLevel of CLASSES) {
    for (const subject of SUBJECTS) {
      options.push({
        value: `${classLevel}-${subject}`,
        label: `Class ${classLevel} - ${subject}`,
        class: classLevel,
        subject,
      });
    }
  }
  return options;
}

export function parseCombinedValue(
  value: string | null | undefined,
): { class: number | null; subject: string | null } {
  if (!value) return { class: null, subject: null };
  const parts = value.split("-");
  const classLevel = Number.parseInt(parts[0] ?? "", 10);
  const subject = parts.slice(1).join("-");
  return {
    class: Number.isFinite(classLevel) ? classLevel : null,
    subject: subject || null,
  };
}

export function createCombinedValue(
  classLevel: number | null | undefined,
  subject: string | null | undefined,
): string {
  if (!classLevel || !subject) return "";
  return `${classLevel}-${subject}`;
}

export function parseGroupName(
  groupName: string | null | undefined,
): { class: number | null; subject: string | null; batchYear: number | null } {
  if (!groupName) return { class: null, subject: null, batchYear: null };
  const match = groupName.match(/^(.+)_Class(\d+)_(\d+)$/);
  if (match) {
    return {
      class: Number.parseInt(match[2]!, 10),
      subject: match[1]!,
      batchYear: Number.parseInt(match[3]!, 10),
    };
  }
  return { class: null, subject: null, batchYear: null };
}

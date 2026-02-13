/**
 * Academic Constants
 * Centralized constants for subjects, classes, and difficulty levels
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const SUBJECTS = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
  "Hindi",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science"
];

export const CLASSES = [5, 6, 7, 8, 9, 10, 11, 12];

export const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "advanced"];

export const QUESTION_TYPES = ["mcq", "fillup", "short_answer", "long_answer"];

/**
 * Fetch subjects from curriculum API
 * @param {number} classLevel - Optional class level filter
 * @returns {Promise<Array>} Array of subjects
 */
export const fetchCurriculumSubjects = async (classLevel = null) => {
  try {
    let url = `${API_URL}/api/curriculum/subjects?is_active=true`;
    if (classLevel) {
      url += `&class_level=${classLevel}`;
    }
    
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch curriculum subjects:", err);
    return [];
  }
};

/**
 * Fetch subject details with chapters and topics
 * @param {string} subjectId - Subject identifier
 * @returns {Promise<Object|null>} Subject details or null
 */
export const fetchSubjectDetails = async (subjectId) => {
  try {
    const response = await fetch(`${API_URL}/api/curriculum/subjects/${subjectId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch subject details:", err);
    return null;
  }
};

/**
 * Generate combined class-subject options
 * @returns {Array} Array of {value, label, class, subject} objects
 */
export const getCombinedClassSubjectOptions = () => {
  const options = [];
  
  CLASSES.forEach(classLevel => {
    SUBJECTS.forEach(subject => {
      options.push({
        value: `${classLevel}-${subject}`,
        label: `Class ${classLevel} - ${subject}`,
        class: classLevel,
        subject: subject
      });
    });
  });
  
  return options;
};

/**
 * Parse combined value back to class and subject
 * @param {string} value - Combined value in format "classLevel-subject"
 * @returns {Object} {class: number, subject: string}
 */
export const parseCombinedValue = (value) => {
  if (!value) return { class: null, subject: null };
  
  const parts = value.split('-');
  const classLevel = parseInt(parts[0]);
  const subject = parts.slice(1).join('-'); // Handle subjects with hyphens
  
  return { class: classLevel, subject: subject };
};

/**
 * Create combined value from class and subject
 * @param {number} classLevel 
 * @param {string} subject 
 * @returns {string} Combined value
 */
export const createCombinedValue = (classLevel, subject) => {
  if (!classLevel || !subject) return '';
  return `${classLevel}-${subject}`;
};

/**
 * Parse group name to extract class and subject
 * Group name format: Subject_ClassX_Year (e.g., "Mathematics_Class10_2026")
 * @param {string} groupName - Group name
 * @returns {Object} {class: number, subject: string, batchYear: number}
 */
export const parseGroupName = (groupName) => {
  if (!groupName) return { class: null, subject: null, batchYear: null };
  
  // Extract pattern: Subject_ClassX_Year
  const match = groupName.match(/^(.+)_Class(\d+)_(\d+)$/);
  
  if (match) {
    return {
      class: parseInt(match[2]),
      subject: match[1],
      batchYear: parseInt(match[3])
    };
  }
  
  return { class: null, subject: null, batchYear: null };
};

// @ts-nocheck
import { BookOpen, ChevronRight } from 'lucide-react';

// Sidebar list of lessons for the Book-to-Bot PDF reader
export default function LessonNavigation({ lessons, currentLesson, onLessonSelect }) {
  return (
    <div className="flex flex-col h-full border-r bg-white dark:bg-gray-900">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Lessons</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {(lessons ?? []).map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => onLessonSelect(lesson)}
            className={`w-full text-left mb-1 rounded-xl px-3 py-3 flex items-start gap-3 transition-colors ${currentLesson?.id === lesson.id
              ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100'
              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
          >
            <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {lesson.number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2">{lesson.title}</p>
              {lesson.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{lesson.description.slice(0, 39)}</p>
              )}
            </div>
            {currentLesson?.id === lesson.id && <ChevronRight className="flex-shrink-0 h-4 w-4 mt-1" />}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400">{(lessons ?? []).length} Lesson{lessons?.length !== 1 ? 's' : ''} Available</p>
      </div>
    </div>
  );
}


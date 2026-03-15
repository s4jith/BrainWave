import React, { useState } from 'react';
import { BookOpen, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import type { StudentSubject } from '@/types';

interface StudentSubjectCardProps {
    subject: StudentSubject;
}

export const StudentSubjectCard: React.FC<StudentSubjectCardProps> = ({ subject }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 font-bold text-white shadow-sm">
                        {(subject.subject_name || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{subject.subject_name}</h3>
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                                <GraduationCap className="h-3.5 w-3.5" />
                                Class {subject.class_level}
                            </span>
                            <span className="flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5" />
                                {subject.total_chapters} {subject.total_chapters === 1 ? 'chapter' : 'chapters'}
                            </span>
                        </div>
                    </div>
                </div>
                {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>

            {expanded && (
                <div className="border-t border-gray-50 px-6 pb-4 pt-4 dark:border-gray-700">
                    <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Chapters & Topics
                    </h4>
                    <div className="space-y-3">
                        {subject.chapters && subject.chapters.map((ch, idx) => (
                            <div key={idx} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{ch.chapter_number}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{ch.title}</p>
                                        {ch.topics && ch.topics.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {ch.topics.map((topic, tIdx) => (
                                                    <span
                                                        key={tIdx}
                                                        className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                                    >
                                                        {topic}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!subject.chapters || subject.chapters.length === 0) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No chapters mapped yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, Users, ChevronDown, ChevronUp, Calendar, Clock, FileText, MessageSquare } from 'lucide-react';
import type { StudentGroup } from '@/types';

interface StudentGroupCardProps {
    group: StudentGroup;
}

export const StudentGroupCard: React.FC<StudentGroupCardProps> = ({ group }) => {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 font-bold text-white shadow-sm">
                        {(group.subject || group.name || 'G')[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            {group.subject && (
                                <span className="flex items-center gap-1">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    {group.subject}
                                </span>
                            )}
                            {group.class_level && (
                                <span className="flex items-center gap-1">
                                    <GraduationCap className="h-3.5 w-3.5" />
                                    Class {group.class_level}
                                </span>
                            )}
                            {(group.student_count ?? 0) > 0 && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {group.student_count} students
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {(group.test_count ?? 0) > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            {group.test_count} {group.test_count === 1 ? 'test' : 'tests'}
                        </span>
                    )}
                    {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-50 px-6 pb-4 pt-2 dark:border-gray-700">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Teacher Info */}
                        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
                            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Teacher</h4>
                            {group.teacher ? (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                                        <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{group.teacher.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{group.teacher.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500">No teacher assigned</p>
                            )}
                        </div>

                        {/* Details Info */}
                        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
                            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Details</h4>
                            <div className="space-y-2 text-sm">
                                {group.description && (
                                    <p className="text-gray-600 dark:text-gray-400">{group.description}</p>
                                )}
                                {group.batch_year && (
                                    <p className="text-gray-500 dark:text-gray-400">
                                        <Calendar className="mr-1 inline h-3.5 w-3.5" />
                                        Batch {group.batch_year}
                                    </p>
                                )}
                                <p className="text-gray-500 dark:text-gray-400">
                                    <Clock className="mr-1 inline h-3.5 w-3.5" />
                                    Joined {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-3">
                        <button
                            onClick={() => router.push('/student/tests')}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                        >
                            <FileText className="h-4 w-4" />
                            View Tests
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import type { AdminAnalyticsData } from '@/types';

interface TopPerformersListProps {
    topPerformers: AdminAnalyticsData['top_performers'];
    weakStudents: AdminAnalyticsData['weak_students'];
}

export const TopPerformersList: React.FC<TopPerformersListProps> = ({ topPerformers, weakStudents }) => {
    return (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Performers */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">🏆 Top Performers</h2>
                {topPerformers && topPerformers.length > 0 ? (
                    <div className="space-y-3">
                        {topPerformers.map((student, i) => (
                            <div
                                key={student.student_id || i}
                                className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-3 dark:from-amber-900/20 dark:to-orange-900/20"
                            >
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{student.tests_completed} tests completed</p>
                                    </div>
                                </div>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{student.avg_score}%</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-8 text-center text-gray-400 dark:text-gray-500">No top performers yet.</p>
                )}
            </div>

            {/* Needs Attention */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">⚠️ Needs Attention</h2>
                {weakStudents && weakStudents.length > 0 ? (
                    <div className="space-y-3">
                        {weakStudents.map((student, i) => (
                            <div
                                key={student.student_id || i}
                                className="flex items-center justify-between rounded-xl bg-gradient-to-r from-rose-50 to-orange-50 p-3 dark:from-rose-900/20 dark:to-orange-900/20"
                            >
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{student.days_inactive} days inactive</p>
                                    </div>
                                </div>
                                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{student.avg_score}%</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="py-8 text-center text-gray-400 dark:text-gray-500">No struggling students identified yet.</p>
                )}
            </div>
        </div>
    );
};

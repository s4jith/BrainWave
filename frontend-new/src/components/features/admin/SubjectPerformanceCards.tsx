import React from 'react';
import type { AdminAnalyticsData } from '@/types';

interface SubjectPerformanceCardsProps {
    stats: AdminAnalyticsData['subject_stats'];
}

export const SubjectPerformanceCards: React.FC<SubjectPerformanceCardsProps> = ({ stats }) => {
    return (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Subject-wise Performance</h2>
            {stats && stats.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {stats.map((subject, i) => {
                        const isGood = subject.avg_score >= 70;
                        const isOk = subject.avg_score >= 50;
                        const scoreColor = isGood ? 'text-emerald-600 dark:text-emerald-400' : isOk ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                        const barColor = isGood ? 'bg-emerald-500' : isOk ? 'bg-amber-500' : 'bg-rose-500';

                        return (
                            <div key={i} className="rounded-xl border border-gray-100 p-4 transition-shadow hover:shadow-md dark:border-gray-700">
                                <h3 className="mb-2 font-medium text-gray-900 dark:text-white">{subject.subject}</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Avg Score</span>
                                        <span className={`font-semibold ${scoreColor}`}>{subject.avg_score}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${subject.avg_score}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>{subject.total_tests} tests</span>
                                        <span>{subject.total_students} students</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="py-8 text-center text-gray-400 dark:text-gray-500">
                    No subject data yet. Create tests and have students take them to see performance data.
                </p>
            )}
        </div>
    );
};

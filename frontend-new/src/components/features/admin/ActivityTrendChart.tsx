import React from 'react';
import type { AdminAnalyticsData } from '@/types';

interface ActivityTrendChartProps {
    trend: AdminAnalyticsData['activity_trend'];
}

export const ActivityTrendChart: React.FC<ActivityTrendChartProps> = ({ trend }) => {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">User Activity (Last 14 Days)</h2>
            {trend && trend.length > 0 ? (
                <>
                    <div className="flex h-64 items-end justify-between gap-1">
                        {trend.map((day, i) => (
                            <div key={i} className="flex flex-1 flex-col items-center">
                                <div className="flex w-full flex-col items-center gap-1">
                                    <div
                                        className="w-full rounded-t bg-indigo-500 dark:bg-indigo-400"
                                        style={{ height: `${Math.max(day.active_users * 3, 2)}px` }}
                                        title={`${day.active_users} users`}
                                    />
                                    <div
                                        className="w-full rounded-t bg-emerald-500 dark:bg-emerald-400"
                                        style={{ height: `${Math.max(day.tests_taken * 4, 2)}px` }}
                                        title={`${day.tests_taken} tests`}
                                    />
                                </div>
                                <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {day.date?.slice(5)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-indigo-500 dark:bg-indigo-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">Active Users</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded bg-emerald-500 dark:bg-emerald-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">Tests Taken</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex h-64 items-center justify-center text-center text-gray-400 dark:text-gray-500">
                    <p>No activity data yet. Data will appear as users interact with the platform.</p>
                </div>
            )}
        </div>
    );
};

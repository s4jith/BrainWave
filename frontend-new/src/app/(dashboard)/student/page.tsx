'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    BookOpen, Award, TrendingUp, Calendar, Users, CheckCircle,
    BarChart3, MessageCircle, FileText, GraduationCap,
} from 'lucide-react';
import { DashboardLayout } from '../../../components/common/DashboardLayout';
import { StatCard } from '../../../components/ui/Card';
import { QuickActionCard } from '../../../components/ui/QuickActionCard';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageLoader, TableLoader } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { useAsync } from '../../../hooks/useAsync';
import { useAuthStore } from '../../../stores/authStore';
import { studentService } from '../../../services/student.service';
import { gradebookService } from '../../../services/gradebook.service';
import { formatDate } from '../../../utils/formatters';

// ── Local types matching API shapes ─────────────────────────────────────────
interface StudentStats { completed_assessments: number; average_score: number; upcoming_deadlines: number }
interface Grade { submission_id: string; assessment_title: string; assessment_type: string; percentage: number; passed: boolean }
interface Group { id: string; name: string; subject?: string; class_level?: number; description?: string; teacher?: { name: string } }
interface Subject { name?: string; subject_name?: string; class_level?: number; total_chapters?: number }

// ── Single batched fetch ─────────────────────────────────────────────────────
async function loadDashboard() {
    const [statsRes, gradesRes, groupsRes, subjectsRes, featuresRes] = await Promise.allSettled([
        gradebookService.getStudentStats(),
        gradebookService.getMyGrades(),
        studentService.getGroups(),
        studentService.getSubjects(),
        studentService.getFeatures(),
    ]);
    return {
        stats: statsRes.status === 'fulfilled' ? (statsRes.value as unknown as StudentStats) : null,
        grades: gradesRes.status === 'fulfilled' ? ((gradesRes.value as unknown as { grades?: Grade[] }).grades ?? []).slice(0, 5) : [] as Grade[],
        groups: groupsRes.status === 'fulfilled' ? (groupsRes.value.groups as Group[]) : [] as Group[],
        subjects: subjectsRes.status === 'fulfilled' ? ((subjectsRes.value as unknown as { subjects?: Subject[] }).subjects ?? []) : [] as Subject[],
        features: featuresRes.status === 'fulfilled' ? featuresRes.value.features : {} as Record<string, boolean>,
    };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
    const router = useRouter();
    const user = useAuthStore((s: { user: { name?: string } | null }) => s.user);
    const { data, loading, error, run } = useAsync(loadDashboard);

    useEffect(() => { run(); }, [run]);

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading dashboard…" /></DashboardLayout>;

    const stats = data?.stats ?? null;
    const grades = data?.grades ?? [];
    const groups = data?.groups ?? [];
    const subjects = data?.subjects ?? [];
    const features = data?.features ?? {};

    const quickActions = [
        { title: 'My Groups', description: 'View your groups', icon: Users, iconColor: 'bg-indigo-500', path: '/student/groups' },
        { title: 'My Grades', description: 'View your progress', icon: Award, iconColor: 'bg-emerald-500', path: '/student/grades', fk: 'my_grades' },
        { title: 'Test Center', description: 'AI & Staff tests', icon: CheckCircle, iconColor: 'bg-purple-500', path: '/student/tests', fk: 'test_center' },
        { title: 'Book to Bot', description: 'AI-powered learning', icon: BookOpen, iconColor: 'bg-orange-500', path: '/student/book-to-bot', fk: 'book_to_bot' },
        { title: 'Notes', description: 'AI-powered notes', icon: BarChart3, iconColor: 'bg-amber-500', path: '/student/notes' },
        { title: 'Feedback', description: 'Share feedback', icon: MessageCircle, iconColor: 'bg-rose-500', path: '/student/suggestions' },
        { title: 'Statistics', description: 'View your stats', icon: TrendingUp, iconColor: 'bg-cyan-500', path: '/student/report-card' },
    ];

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.name?.split(' ')[0] ?? 'Student'}! 👋
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track your progress and continue learning.</p>
            </div>

            {error && <AlertBanner variant="error" message="Some data failed to load. Showing available info." className="mb-6" />}

            {/* Stats */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" />
                    ))
                ) : (
                    <>
                        <StatCard icon={CheckCircle} label="Completed" value={stats?.completed_assessments ?? 0} description="Total assessments" />
                        <StatCard icon={TrendingUp} label="Average Score" value={`${stats?.average_score ?? 0}%`} description="Across all tests" />
                        <StatCard icon={Calendar} label="Upcoming" value={stats?.upcoming_deadlines ?? 0} description="Pending deadlines" />
                    </>
                )}
            </div>

            {/* Quick Actions */}
            <section className="mb-8">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {quickActions.map((a) => (
                        <QuickActionCard
                            key={a.title}
                            title={a.title}
                            description={a.description}
                            icon={a.icon}
                            iconColor={a.iconColor}
                            onClick={() => router.push(a.path)}
                            locked={!!(a.fk && !features[a.fk])}
                        />
                    ))}
                </div>
            </section>

            {/* My Groups */}
            <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Groups</h2>
                    <button onClick={() => router.push('/student/groups')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">View all →</button>
                </div>
                {loading ? <TableLoader rows={2} /> : groups.length === 0 ? (
                    <EmptyState icon={<Users className="h-7 w-7" />} title="No groups yet" description="You haven't been assigned to any groups." />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {groups.slice(0, 3).map((g) => (
                            <div key={g.id} onClick={() => router.push('/student/groups')} className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                                        <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    {g.teacher && (
                                        <span className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                            <GraduationCap className="h-3 w-3" /> {g.teacher.name}
                                        </span>
                                    )}
                                </div>
                                <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">{g.name}</h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {g.subject && <Badge variant="success">{g.subject}</Badge>}
                                    {g.class_level && <Badge variant="info">Class {g.class_level}</Badge>}
                                </div>
                                {g.description && <p className="mt-2 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{g.description}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* My Subjects */}
            {subjects.length > 0 && (
                <section className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">My Subjects</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {subjects.map((s, i) => (
                            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">{s.subject_name ?? s.name}</h3>
                                {s.class_level && <Badge variant="secondary" className="mb-1">Class {s.class_level}</Badge>}
                                {s.total_chapters != null && <p className="text-xs text-gray-500">{s.total_chapters} chapters</p>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Recent Grades */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Grades</h2>
                    <button onClick={() => router.push('/student/grades')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">View all →</button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    {loading ? <div className="p-4"><TableLoader rows={5} /></div>
                        : grades.length === 0 ? <EmptyState icon={<Award className="h-7 w-7" />} title="No grades yet" description="Complete an assessment to see grades here." />
                            : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {grades.map((g) => (
                                        <div key={g.submission_id} className="flex items-center justify-between px-5 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{g.assessment_title}</p>
                                                <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{g.assessment_type}</p>
                                            </div>
                                            <span className={`text-lg font-bold ${g.passed ? 'text-emerald-500' : 'text-red-500'}`}>{g.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                </div>
            </section>
        </DashboardLayout>
    );
}

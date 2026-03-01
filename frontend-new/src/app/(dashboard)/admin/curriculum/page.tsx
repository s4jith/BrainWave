'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/common/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader, TableLoader } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { curriculumService } from '@/services/curriculum.service';
import type { SubjectSummary } from '@/types';

// ── Admin Curriculum – manage subjects and chapters for each class level ───────
export default function AdminCurriculumPage() {
    const [classFilter, setClassFilter] = useState<number>(6);
    const [showAdd, setShowAdd] = useState(false);
    const [subjectName, setSubjectName] = useState('');
    const [subjectClass, setSubjectClass] = useState(6);
    const [adding, setAdding] = useState(false);

    const { data, loading, error, run } = useAsync(async (): Promise<SubjectSummary[]> => {
        const res = await curriculumService.getSubjects(classFilter);
        console.log('[curriculum] Loaded', res.length, 'subjects for class', classFilter);
        return res;
    });
    useEffect(() => { run(); }, [run, classFilter]);

    const subjects = data ?? [];

    const handleAddSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        try {
            await curriculumService.createSubject({ name: subjectName, class_level: subjectClass });
            console.log('[curriculum] Created subject:', subjectName);
            setShowAdd(false); setSubjectName('');
            run();
        } catch { /* inline error */ }
        setAdding(false);
    };

    const handleDelete = async (subjectId: string) => {
        if (!confirm('Delete this subject and all its chapters?')) return;
        await curriculumService.deleteSubject(subjectId);
        console.log('[curriculum] Deleted subject:', subjectId);
        run();
    };

    if (loading && !data) return <DashboardLayout><PageLoader text="Loading curriculum…" /></DashboardLayout>;

    return (
        <DashboardLayout>
            <PageHeader title="Curriculum" description="Manage subjects and chapters for each class level." />

            {error && <AlertBanner variant="warning" message="Could not load curriculum." className="mb-5" />}

            {/* Class filter chips */}
            <div className="mb-5 flex flex-wrap gap-2">
                {Array.from({ length: 7 }, (_, i) => i + 6).map((cl) => (
                    <button key={cl} onClick={() => setClassFilter(cl)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${classFilter === cl ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>
                        Class {cl}
                    </button>
                ))}
            </div>

            <div className="mb-5 flex justify-end">
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add Subject</Button>
            </div>

            {loading ? <TableLoader rows={5} />
                : subjects.length === 0 ? <EmptyState icon={<BookOpen className="h-7 w-7" />} title="No subjects for this class" description="Add a subject to get started." />
                    : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {subjects.map((s) => (
                                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                                        <button onClick={() => handleDelete(s.id)} className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        <Badge variant="info">Class {s.class_level}</Badge>
                                        {s.total_chapters != null && <Badge variant="secondary">{s.total_chapters} chapters</Badge>}
                                        <Badge variant={s.is_active ? 'success' : 'warning'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                                    </div>
                                    {s.board && <p className="text-xs text-gray-400">Board: {s.board}</p>}
                                </div>
                            ))}
                        </div>
                    )}

            {/* Add subject modal */}
            <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Subject">
                <form onSubmit={handleAddSubject} className="space-y-4">
                    <input required placeholder="Subject name *" value={subjectName} onChange={(e) => setSubjectName(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class Level</label>
                        <input type="number" min={1} max={12} value={subjectClass} onChange={(e) => setSubjectClass(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button type="submit" loading={adding}>Add Subject</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}

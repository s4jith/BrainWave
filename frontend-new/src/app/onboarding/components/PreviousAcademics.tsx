'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import subjectsData from '@/data/subjects.json';

interface AcademicSubject {
  name: string;
  marks: number;
}

interface PreviousAcademicsProps {
  data: {
    subjects: AcademicSubject[];
  };
  classLevel: number;
  onNext: (data: { subjects: AcademicSubject[] }) => void;
  onSkip: () => void;
}

export default function PreviousAcademics({ data, classLevel, onNext, onSkip }: PreviousAcademicsProps) {
  const [subjects, setSubjects] = useState<AcademicSubject[]>(data.subjects || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', marks: '' });

  const availableSubjects = subjectsData.subjects.filter(s => s.availableFor.includes(classLevel));
  const unaddedSubjects = availableSubjects.filter(s => !subjects.find(added => added.name === s.name));

  const addSubject = () => {
    if (newSubject.name && newSubject.marks) {
      const marks = parseInt(newSubject.marks);
      if (marks >= 0 && marks <= 100) {
        setSubjects([...subjects, { name: newSubject.name, marks }]);
        setNewSubject({ name: '', marks: '' });
        setShowAddForm(false);
      }
    }
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const getGradeInfo = (marks: number) => {
    const range = subjectsData.markRanges.find(r => marks >= r.min && marks <= r.max);
    return range || { grade: '-', label: '' };
  };

  const handleNext = () => {
    onNext({ subjects });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Previous Year Academics</h2>
        <p className="text-muted-foreground">Add your subjects and marks to help us understand your strengths</p>
      </div>

      {subjects.length > 0 && (
        <div className="space-y-3 mb-6">
          {subjects.map((subject, index) => {
            const gradeInfo = getGradeInfo(subject.marks);
            return (
              <div key={index} className="flex items-center justify-between p-4 bg-card border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{subject.name}</p>
                  <p className="text-sm text-muted-foreground">{subject.marks} marks • {gradeInfo.grade} ({gradeInfo.label})</p>
                </div>
                <button onClick={() => removeSubject(index)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm ? (
        <div className="p-4 border-2 border-dashed rounded-lg mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Subject</label>
            <Input
              type="text"
              value={newSubject.name}
              onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="Enter subject name"
              className="h-12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Marks (out of 100)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={newSubject.marks}
              onChange={(e) => setNewSubject({ ...newSubject, marks: e.target.value })}
              placeholder="Enter marks"
              className="h-12"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={addSubject} disabled={!newSubject.name || !newSubject.marks} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              Add
            </Button>
            <Button variant="outline" onClick={() => { setShowAddForm(false); setNewSubject({ name: '', marks: '' }); }} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      ) : unaddedSubjects.length > 0 ? (
        <button onClick={() => setShowAddForm(true)} className="w-full p-4 border-2 border-dashed rounded-lg text-muted-foreground hover:text-foreground hover:border-gray-400 transition-colors flex items-center justify-center gap-2 mb-6">
          <Plus className="w-5 h-5" /> Add a subject
        </button>
      ) : null}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1 h-12">Skip for now</Button>
        <Button onClick={handleNext} className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white">Next</Button>
      </div>
    </div>
  );
}

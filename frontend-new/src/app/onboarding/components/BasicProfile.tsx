'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import classesData from '@/data/classes.json';

interface BasicProfileProps {
  data: {
    name: string;
    classLevel: number;
  };
  onNext: (data: { name: string; classLevel: number }) => void;
}

export default function BasicProfile({ data, onNext }: BasicProfileProps) {
  const [formData, setFormData] = useState({
    name: data.name || '',
    classLevel: data.classLevel || 6
  });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (formData.name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onNext(formData);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Tell us about yourself</h2>
        <p className="text-muted-foreground">This helps us personalize your learning experience</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">What's your name?</label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              setError('');
            }}
            placeholder="Enter your name"
            className="h-12"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Which class are you in?</label>
          <div className="grid grid-cols-4 gap-2">
            {classesData.classes.map((cls) => (
              <button
                key={cls.level}
                type="button"
                onClick={() => setFormData({ ...formData, classLevel: cls.level })}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  formData.classLevel === cls.level
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-border hover:border-indigo-300'
                }`}
              >
                <span className="font-medium text-sm">{cls.level}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" className="w-full h-12 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white">
          Next
        </Button>
      </form>
    </div>
  );
}

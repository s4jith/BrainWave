'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import BasicProfile from './components/BasicProfile';
import PreviousAcademics from './components/PreviousAcademics';
import AvatarUsername from './components/AvatarUsername';
import ExamCalendar from './components/ExamCalendar';
import { siteConfig } from '@/config/site';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEPS = [
  { id: 1, title: 'Basic Profile', required: true },
  { id: 2, title: 'Previous Academics', required: false },
  { id: 3, title: 'Avatar & Username', required: false },
  { id: 4, title: 'Exam Calendar', required: false }
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    profile: {
      name: user?.name || '',
      classLevel: 6
    },
    academics: {
      subjects: []
    },
    avatar: {
      seed: Date.now().toString(),
      style: 'avataaars',
      username: ''
    },
    calendar: {
      exams: []
    }
  });

  const handleNext = (stepData: any) => {
    switch (currentStep) {
      case 1:
        setOnboardingData(prev => ({ ...prev, profile: stepData }));
        break;
      case 2:
        setOnboardingData(prev => ({ ...prev, academics: stepData }));
        break;
      case 3:
        setOnboardingData(prev => ({ ...prev, avatar: stepData }));
        break;
      case 4:
        setOnboardingData(prev => ({ ...prev, calendar: stepData }));
        break;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      if (user?.id) {
        const response = await fetch(`${API_BASE}/api/auth/complete-onboarding`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user?.id,
            profile: onboardingData.profile,
            academics: onboardingData.academics,
            avatar: onboardingData.avatar,
            calendar: onboardingData.calendar
          })
        });
        const data = await response.json();
        if (!data.success) {
          console.error("Failed to save onboarding:", data.error);
        }
      }
    } catch (error) {
      console.error("Onboarding save error:", error);
    }

    if (user) {
      updateUser({
        name: onboardingData.profile.name,
        // In a real app we'd map this explicitly if user type defines it
        // @ts-ignore
        classLevel: onboardingData.profile.classLevel,
        // @ts-ignore
        isOnboarded: true
      });
    }

    router.push('/student'); // Route to default dashboard (assuming student dashboard via role handler eventually)
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicProfile data={onboardingData.profile} onNext={handleNext} />;
      case 2:
        return (
          <PreviousAcademics
            data={onboardingData.academics}
            classLevel={onboardingData.profile.classLevel}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        );
      case 3:
        return <AvatarUsername data={onboardingData.avatar} onNext={handleNext} onSkip={handleSkip} />;
      case 4:
        return <ExamCalendar data={onboardingData.calendar} onNext={handleNext} onSkip={handleSkip} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Progress */}
      <div className="border-b bg-gray-50 border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Let's get you set up</h1>
            <span className="text-sm text-gray-400">Step {currentStep} of {STEPS.length}</span>
          </div>

          <div className="flex gap-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  step.id <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex justify-between mt-3 px-1">
            {STEPS.map((step) => (
              <span
                key={step.id}
                className={`text-xs ${
                  step.id === currentStep ? 'text-indigo-600 font-bold' : 'text-gray-400'
                }`}
              >
                {step.title}
                {!step.required && <span className="ml-1 opacity-50">(optional)</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {renderStep()}
      </div>
    </div>
  );
}

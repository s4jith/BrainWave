import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Palette,
  Calendar,
  Shield,
  ArrowLeft,
  Save,
  Plus,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Lightbulb,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Send
} from 'lucide-react';
import useUserStore from '../stores/userStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import classesData from '../data/classes.json';
import authFetch from "../utils/authFetch";

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'avatar', label: 'Avatar', icon: Palette },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'suggestions', label: 'Suggestions', icon: Lightbulb },
];

const AVATAR_STYLES = [
  { id: 'avataaars', name: 'Avatars' },
  { id: 'bottts', name: 'Robots' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'micah', name: 'Micah' },
  { id: 'notionists', name: 'Notion' }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    user,
    academics,
    calendar,
    updateProfile,
    updateAcademics,
    updateCalendar
  } = useUserStore();

  const requestedTab = searchParams.get('tab');
  const isValidTab = TABS.some((t) => t.id === requestedTab);
  const [activeTab, setActiveTab] = useState(isValidTab ? requestedTab : 'profile');
  const [saveMessage, setSaveMessage] = useState('');

  const [profileData, setProfileData] = useState({
    name: user.name || '',
    classLevel: user.classLevel || 6,
  });

  const [subjects, setSubjects] = useState(academics.subjects || []);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', marks: '' });

  const [avatarSeed, setAvatarSeed] = useState(user.avatarSeed || Date.now().toString());
  const [avatarStyle, setAvatarStyle] = useState(user.avatarStyle || 'avataaars');

  const [exams, setExams] = useState(calendar.exams || []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddExam, setShowAddExam] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newExam, setNewExam] = useState({ subject: '', date: '' });

  const [oldPassword, setOldPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const [suggestionSubject, setSuggestionSubject] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionHistoryLoading, setSuggestionHistoryLoading] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [mySuggestions, setMySuggestions] = useState([]);

  const API_BASE = import.meta.env.VITE_API_URL;


  const showSaveMessage = (message) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 2000);
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.id === tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    if (activeTab === 'suggestions') {
      fetchMySuggestions();
    }
  }, [activeTab]);

  const setTab = (tabId) => {
    setActiveTab(tabId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

  const fetchMySuggestions = async () => {
    try {
      setSuggestionHistoryLoading(true);
      const response = await authFetch(`${API_BASE}/api/suggestions/student/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setMySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setSuggestionHistoryLoading(false);
    }
  };

  const submitSuggestion = async (e) => {
    e.preventDefault();
    if (!suggestionSubject.trim() || !suggestionText.trim()) return;

    try {
      setSuggestionLoading(true);
      setSuggestionMessage('');
      const response = await authFetch(`${API_BASE}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.id,
          student_name: user.name || 'Anonymous',
          class_level: user.classLevel || 10,
          category: 'general',
          subject: suggestionSubject,
          content: suggestionText,
          email: user.email || ''
        })
      });

      if (!response.ok) throw new Error('Failed to submit suggestion');
      setSuggestionSubject('');
      setSuggestionText('');
      setSuggestionMessage('Suggestion submitted successfully.');
      fetchMySuggestions();
    } catch (err) {
      console.error('Error submitting suggestion:', err);
      setSuggestionMessage('Failed to submit suggestion. Please try again.');
    } finally {
      setSuggestionLoading(false);
    }
  };

  const getSuggestionStatusIcon = (status) => {
    switch (status) {
      case 'reviewed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSuggestionStatusColor = (status) => {
    switch (status) {
      case 'reviewed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getAvatarUrl = (style, seed) => {
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
  };

  const regenerateAvatar = () => {
    setAvatarSeed(Date.now().toString());
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentMonth + direction);
    setCurrentDate(newDate);
  };

  const formatDate = (date) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  };

  const getExamsForDate = (date) => {
    const dateStr = formatDate(date);
    return exams.filter(exam => exam.date === dateStr);
  };

  const handleDateClick = (date) => {
    const dateStr = formatDate(date);
    setSelectedDate(dateStr);
    setNewExam({ ...newExam, date: dateStr });
    setShowAddExam(true);
  };

  const saveProfile = () => {
    updateProfile({
      name: profileData.name,
      classLevel: profileData.classLevel,
    });
    showSaveMessage('Profile saved!');
  };

  const addSubject = () => {
    if (newSubject.name && newSubject.marks) {
      const marks = parseInt(newSubject.marks);
      if (marks >= 0 && marks <= 100) {
        const updatedSubjects = [...subjects, { ...newSubject, marks }];
        setSubjects(updatedSubjects);
        updateAcademics({ subjects: updatedSubjects });
        setNewSubject({ name: '', marks: '' });
        setShowAddSubject(false);
        showSaveMessage('Subject added!');
      }
    }
  };

  const removeSubject = (index) => {
    const updatedSubjects = subjects.filter((_, i) => i !== index);
    setSubjects(updatedSubjects);
    updateAcademics({ subjects: updatedSubjects });
    showSaveMessage('Subject removed!');
  };

  const saveAvatar = async () => {
    try {
      // Reuse onboarding update path to persist avatar selections for existing students.
      await authFetch(`${import.meta.env.VITE_API_URL}/api/auth/complete-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          avatar: {
            seed: avatarSeed,
            style: avatarStyle,
          },
        }),
      });
    } catch {
      // Keep local save even if network call fails, so UI does not break offline.
    }

    updateProfile({
      avatarSeed,
      avatarStyle,
    });
    showSaveMessage('Avatar saved!');
  };

  const addExam = () => {
    if (newExam.subject && newExam.date) {
      const updatedExams = [...exams, { ...newExam, id: Date.now() }];
      setExams(updatedExams);
      updateCalendar({ exams: updatedExams });
      setNewExam({ subject: '', date: '' });
      setShowAddExam(false);
      setSelectedDate(null);
      showSaveMessage('Exam added!');
    }
  };

  const removeExam = (id) => {
    const updatedExams = exams.filter(exam => exam.id !== id);
    setExams(updatedExams);
    updateCalendar({ exams: updatedExams });
    showSaveMessage('Exam removed!');
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    if (!oldPassword || !newPwd || !confirmPwd) { setPwdError('All fields are required.'); return; }
    if (newPwd.length < 8) { setPwdError('New password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match.'); return; }
    setPwdLoading(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/api/auth/change-password-secure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, old_password: oldPassword, new_password: newPwd, confirm_password: confirmPwd })
      });
      const data = await res.json();
      if (data.success) {
        setPwdSuccess('Password changed successfully!');
        setOldPassword(''); setNewPwd(''); setConfirmPwd('');
      } else {
        setPwdError(data.error || 'Failed to change password.');
      }
    } catch {
      setPwdError('Network error. Please try again.');
    }
    setPwdLoading(false);
  };


  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <Input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Enter your name"
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Class Level
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                <p className="text-sm text-gray-800 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Class level can only be changed by admin. Contact support if needed.</span>
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {classesData.classes.map((cls) => (
                  <button
                    key={cls.level}
                    type="button"
                    disabled={true}
                    className={`p-3 rounded-lg border-2 text-center transition-all duration-200 cursor-not-allowed opacity-60 ${profileData.classLevel === cls.level
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200'
                      }`}
                  >
                    <span className="font-medium">{cls.level}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={saveProfile} className="w-full h-12">
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </Button>
          </div>
        );

      case 'academics':
        return (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              Track your previous year subjects and marks to help personalize your learning.
            </p>

            {subjects.length > 0 && (
              <div className="space-y-3">
                {subjects.map((subject, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{subject.name}</p>
                      <p className="text-sm text-gray-500">{subject.marks} marks</p>
                    </div>
                    <button
                      onClick={() => removeSubject(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddSubject ? (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <Input
                    type="text"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                    placeholder="Enter subject name"
                    className="h-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marks (out of 100)</label>
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
                  <Button onClick={addSubject} disabled={!newSubject.name || !newSubject.marks} className="flex-1">
                    Add Subject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowAddSubject(false); setNewSubject({ name: '', marks: '' }); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddSubject(true)}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add a subject
              </button>
            )}
          </div>
        );

      case 'avatar':
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <img
                  src={getAvatarUrl(avatarStyle, avatarSeed)}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-lg"
                />
                <button
                  type="button"
                  onClick={regenerateAvatar}
                  className="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors shadow-lg"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose a style
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setAvatarStyle(style.id)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 ${avatarStyle === style.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                      }`}
                  >
                    <img
                      src={getAvatarUrl(style.id, avatarSeed)}
                      alt={style.name}
                      className="w-10 h-10 mb-1"
                    />
                    <span className="text-xs text-gray-600">{style.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={saveAvatar} className="w-full h-12">
              <Save className="w-4 h-4 mr-2" />
              Save Avatar
            </Button>
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-6">

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Manage your exam dates and reminders
              </p>
              <Button
                onClick={() => {
                  setSelectedDate(formatDate(new Date().getDate()));
                  setNewExam({ subject: '', date: formatDate(new Date().getDate()), type: 'exam' });
                  setShowAddExam(true);
                }}
                className="bg-gray-900 hover:bg-black text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">
                  {MONTHS[currentMonth]} {currentYear}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-100">
                {WEEKDAYS.map((day, index) => (
                  <div
                    key={day}
                    className={`text-center text-xs font-medium text-gray-500 py-3 ${index < 6 ? 'border-r border-gray-100' : ''
                      }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const isLastInRow = (index + 1) % 7 === 0;
                  const isInLastRow = index >= calendarDays.length - 7;

                  if (day === null) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className={`min-h-[100px] bg-gray-50 ${!isLastInRow ? 'border-r border-gray-100' : ''
                          } ${!isInLastRow ? 'border-b border-gray-100' : ''}`}
                      />
                    );
                  }

                  const dayExams = getExamsForDate(day);
                  const isToday = new Date().getDate() === day &&
                    new Date().getMonth() === currentMonth &&
                    new Date().getFullYear() === currentYear;

                  return (
                    <div
                      key={day}
                      onClick={() => handleDateClick(day)}
                      className={`min-h-[100px] p-2 cursor-pointer transition-colors hover:bg-gray-50 ${!isLastInRow ? 'border-r border-gray-100' : ''
                        } ${!isInLastRow ? 'border-b border-gray-100' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${isToday
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-700'
                            }`}
                        >
                          {day}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {dayExams.slice(0, 3).map((exam, examIndex) => {
                          const colors = [
                            { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-l-emerald-500' },
                            { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-l-pink-500' },
                            { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-blue-500' },
                            { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-l-amber-500' },
                            { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-blue-500' },
                          ];
                          const color = colors[examIndex % colors.length];

                          return (
                            <div
                              key={exam.id}
                              className={`px-2 py-1 text-xs font-medium rounded ${color.bg} ${color.text} border-l-2 ${color.border} truncate`}
                              title={exam.subject}
                            >
                              {exam.subject}
                            </div>
                          );
                        })}
                        {dayExams.length > 3 && (
                          <div className="text-xs text-gray-500 pl-2">
                            +{dayExams.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {showAddExam && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-gray-800">Add Event</h4>
                    <button
                      onClick={() => { setShowAddExam(false); setSelectedDate(null); }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-700 font-medium">
                        {selectedDate}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
                      <Input
                        type="text"
                        value={newExam.subject}
                        onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                        placeholder="e.g., Mathematics Unit Test"
                        className="h-12"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => { setShowAddExam(false); setSelectedDate(null); }}
                        className="flex-1 h-12"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={addExam}
                        disabled={!newExam.subject}
                        className="flex-1 h-12 bg-gray-900 hover:bg-black text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Event
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {exams.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">All Events</h4>
                <div className="space-y-2">
                  {exams.map((exam, index) => {
                    const colors = [
                      { bg: 'bg-emerald-50', border: 'border-l-emerald-500', icon: 'bg-emerald-500' },
                      { bg: 'bg-pink-50', border: 'border-l-pink-500', icon: 'bg-pink-500' },
                      { bg: 'bg-orange-50', border: 'border-l-blue-500', icon: 'bg-orange-500' },
                      { bg: 'bg-amber-50', border: 'border-l-amber-500', icon: 'bg-amber-500' },
                      { bg: 'bg-orange-50', border: 'border-l-blue-500', icon: 'bg-orange-500' },
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={exam.id}
                        className={`flex items-center justify-between p-4 ${color.bg} border-l-4 ${color.border} rounded-lg`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${color.icon}`} />
                          <div>
                            <p className="font-medium text-gray-800">{exam.subject}</p>
                            <p className="text-sm text-gray-500">{exam.date}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeExam(exam.id); }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              Update your password. You'll need your current password to make changes.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showOldPwd ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-12 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                />
                <button type="button" onClick={() => setShowOldPwd(!showOldPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full h-12 px-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 transition-all"
              />
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            {pwdError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{pwdError}</p>}
            {pwdSuccess && <p className="text-green-600 text-sm text-center bg-green-50 p-2 rounded-lg">{pwdSuccess}</p>}

            <Button
              onClick={handleChangePassword}
              disabled={pwdLoading}
              className="w-full h-12"
            >
              {pwdLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              {pwdLoading ? 'Changing...' : 'Change Password'}
            </Button>

          </div>
        );

      case 'suggestions':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Suggestions</h3>
                  <p className="text-sm text-gray-600">Share ideas and feedback with the admin team</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-700" />
                Submit Suggestion
              </h4>
              <form onSubmit={submitSuggestion} className="space-y-3">
                <input
                  type="text"
                  value={suggestionSubject}
                  onChange={(e) => setSuggestionSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300"
                  required
                />
                <textarea
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="Describe your suggestion..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                  required
                />
                <button
                  type="submit"
                  disabled={suggestionLoading || !suggestionSubject.trim() || !suggestionText.trim()}
                  className="w-full bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Suggestion
                    </>
                  )}
                </button>
              </form>
              {suggestionMessage && (
                <p className="text-sm mt-3 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {suggestionMessage}
                </p>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">My Suggestions</h4>
              {suggestionHistoryLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : mySuggestions.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No suggestions yet.</p>
              ) : (
                <div className="space-y-3">
                  {mySuggestions.map((item) => (
                    <div key={item.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/70">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.subject || item.category || 'General'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${getSuggestionStatusColor(item.status)}`}>
                            {getSuggestionStatusIcon(item.status)}
                            {item.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{item.content}</p>
                      {item.admin_response && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded-md">
                          <p className="text-xs font-medium text-green-800 mb-0.5">Admin Response</p>
                          <p className="text-sm text-green-700">{item.admin_response}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Settings</h1>
              <p className="text-sm text-gray-500">Manage your profile and preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          <div className="w-56 flex-shrink-0">
            <nav className="space-y-1 sticky top-8">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {TABS.find(t => t.id === activeTab)?.label}
                </h2>
                {saveMessage && (
                  <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    {saveMessage}
                  </span>
                )}
              </div>
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

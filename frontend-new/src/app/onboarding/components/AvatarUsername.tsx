'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Image from 'next/image';

const AVATAR_STYLES = [
  { id: 'avataaars', name: 'Avatars' },
  { id: 'bottts', name: 'Robots' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'micah', name: 'Micah' },
  { id: 'notionists', name: 'Notion' }
];

interface AvatarUsernameProps {
  data: {
    seed: string;
    style: string;
    username: string;
  };
  onNext: (data: { seed: string; style: string; username: string }) => void;
  onSkip: () => void;
}

export default function AvatarUsername({ data, onNext, onSkip }: AvatarUsernameProps) {
  const [avatarSeed, setAvatarSeed] = useState(data.seed || Date.now().toString());
  const [avatarStyle, setAvatarStyle] = useState(data.style || 'avataaars');
  const [username, setUsername] = useState(data.username || '');
  const [error, setError] = useState('');

  const getAvatarUrl = (style: string, seed: string) => `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;

  const handleNext = () => {
    if (username && username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }
    onNext({ seed: avatarSeed, style: avatarStyle, username });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Customize your avatar</h2>
        <p className="text-muted-foreground">Create your unique identity in the app</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="relative w-32 h-32">
          <Image
            src={getAvatarUrl(avatarStyle, avatarSeed)}
            alt="Avatar"
            fill
            className="rounded-full bg-secondary object-cover"
          />
          <button
            type="button"
            onClick={() => setAvatarSeed(Date.now().toString())}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-3">Choose a style</label>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setAvatarStyle(style.id)}
              className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors ${
                avatarStyle === style.id
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-border hover:border-gray-300'
              }`}
            >
              <div className="relative w-10 h-10 mb-1">
                 <Image src={getAvatarUrl(style.id, avatarSeed)} alt={style.name} fill className="object-cover" />
              </div>
              <span className="text-xs text-muted-foreground">{style.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">Choose a username (optional)</label>
        <Input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
            setError('');
          }}
          placeholder="your_username"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground mt-2">Letters, numbers, and underscores only</p>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="flex-1 h-12">Skip</Button>
        <Button onClick={handleNext} className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white">Save & Continue</Button>
      </div>
    </div>
  );
}

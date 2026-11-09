import { Participant } from '../types';
import { useState } from 'react';
import { parseParticipantsText, ParseError, formatParticipantText } from '../utils/parseParticipants';
import { useTranslation } from 'react-i18next';

interface ParticipantsTextViewProps {
  participants: Record<string, Participant>;
  onChangeParticipants: (newParticipants: Record<string, Participant>) => void;
}

export function ParticipantsTextView({ participants, onChangeParticipants }: ParticipantsTextViewProps) {
  const { t } = useTranslation();

  const [text, setText] = useState(() => formatParticipantText(participants));
  const [error, setError] = useState<ParseError | null>(null);

  const handleChange = (newText: string) => {
    setText(newText);
    
    const result = parseParticipantsText(newText, participants);
    if (result.ok) {
      setError(null);
      onChangeParticipants(result.participants);
    } else {
      setError(result);
    }
  };

  return (
    <div className="relative space-y-2">
      <p className="text-xs text-gray-500" id="participants-text-syntax">{t('participants.textSyntax')}</p>
      <textarea
        aria-describedby="participants-text-syntax"
        className={`block w-full h-48 p-2 font-mono text-sm border rounded text-nowrap ${
          error ? 'border-red-500' : ''
        }`}
        value={text}
        onChange={e => handleChange(e.target.value)}
      />

      {error && (
        <div className="bg-red-100 text-red-700 text-sm p-2 rounded">
          {t('errors.line', { number: error.line })}: {t(error.key as any, error.values)}
        </div>
      )}
    </div>
  );
} 
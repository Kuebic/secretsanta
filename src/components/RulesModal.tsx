import { useState, useEffect } from "react";
import { X, Plus, Link, LinkBreak } from "@phosphor-icons/react";
import { Participant, Rule } from '../types';
import { useTranslation } from 'react-i18next';
import { produce } from "immer";

/** A rule being edited. `bothWays` on a Must Not makes it a Mutual exclusion. */
type DraftRule = Rule & { bothWays: boolean };

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantId: string;
  participants: Record<string, Participant>;
  onChangeParticipants: (newParticipants: Record<string, Participant>) => void;
}

export function RulesModal({
  isOpen,
  onClose,
  participantId,
  participants,
  onChangeParticipants,
}: RulesModalProps) {
  const { t } = useTranslation();
  const participant = participants[participantId];
  const hasReverseMustNot = (targetId: string) =>
    participants[targetId]?.rules.some(r => r.type === 'mustNot' && r.targetParticipantId === participantId) ?? false;
  const hasReverseMust = (targetId: string) =>
    participants[targetId]?.rules.some(r => r.type === 'must' && r.targetParticipantId === participantId) ?? false;

  const [localRules, setLocalRules] = useState<DraftRule[]>(() => participant.rules.map(rule => ({
    ...rule,
    bothWays: rule.type === 'mustNot' && hasReverseMustNot(rule.targetParticipantId),
  })));
  // Participants whose Must Not rule back to this participant goes when we save.
  const [removeOtherSideOf, setRemoveOtherSideOf] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [localHint, setLocalHint] = useState<string>(participant.hint || '');

  // Add escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const addRule = (type: 'must' | 'mustNot') => {
    setLocalRules([...localRules, { type, targetParticipantId: '', bothWays: type === 'mustNot' }]);
  };

  const updateRule = (index: number, targetParticipantId: string) => {
    setLocalRules(localRules.map((rule, i) => i === index ? { ...rule, targetParticipantId } : rule));
  };

  const setBothWays = (index: number, bothWays: boolean) => {
    setLocalRules(localRules.map((rule, i) => i === index ? { ...rule, bothWays } : rule));
  };

  const removeRule = (index: number, alsoOtherSide = false) => {
    const rule = localRules[index];
    if (alsoOtherSide) {
      setRemoveOtherSideOf([...removeOtherSideOf, rule.targetParticipantId]);
    }
    setLocalRules(localRules.filter((_, i) => i !== index));
    setPendingRemoval(null);
  };

  const requestRemoveRule = (index: number) => {
    const rule = localRules[index];
    if (rule.type === 'mustNot' && hasReverseMustNot(rule.targetParticipantId)) {
      setPendingRemoval(index);
    } else {
      removeRule(index);
    }
  };

  const handleSave = () => {
    onChangeParticipants(produce(participants, draft => {
      const removeReverse = (targetId: string) => {
        const target = draft[targetId];
        if (!target) return;
        target.rules = target.rules.filter(r => !(r.type === 'mustNot' && r.targetParticipantId === participantId));
      };

      for (const targetId of removeOtherSideOf) {
        removeReverse(targetId);
      }

      for (const rule of localRules) {
        if (rule.type !== 'mustNot' || !draft[rule.targetParticipantId]) continue;
        if (rule.bothWays && !hasReverseMust(rule.targetParticipantId)) {
          const target = draft[rule.targetParticipantId];
          if (!target.rules.some(r => r.type === 'mustNot' && r.targetParticipantId === participantId)) {
            target.rules.push({ type: 'mustNot', targetParticipantId: participantId });
          }
        } else if (!rule.bothWays) {
          removeReverse(rule.targetParticipantId);
        }
      }

      draft[participantId].rules = localRules.map(({ type, targetParticipantId }) => ({ type, targetParticipantId }));
      draft[participantId].hint = localHint || undefined;
    }));
    onClose();
  };

  const hasMustRule = localRules.some(rule => rule.type === 'must');
  const hasMustNotRule = localRules.some(rule => rule.type === 'mustNot');

  if (!isOpen)
      return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-xl w-full">
        <h2 className="text-xl font-bold mb-4">
          {t('rules.title', { name: participant.name })}
        </h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('rules.organizersNoteLabel')}
          </label>
          <input
            type="text"
            value={localHint}
            onChange={(e) => setLocalHint(e.target.value)}
            placeholder={t('rules.organizersNotePlaceholder')}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="space-y-4 mb-6">
          {localRules.map((rule, index) => pendingRemoval === index ? (
            <div key={index} className="p-2 border border-red-300 rounded bg-red-50 space-y-2">
              <p className="text-sm">
                {t('rules.mutualExclusionRemovePrompt', {
                  name: participant.name,
                  other: participants[rule.targetParticipantId]?.name ?? '',
                })}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingRemoval(null)}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800"
                >
                  {t('rules.cancel')}
                </button>
                <button
                  onClick={() => removeRule(index)}
                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                >
                  {t('rules.mutualExclusionRemoveOneSide')}
                </button>
                <button
                  onClick={() => removeRule(index, true)}
                  className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                >
                  {t('rules.mutualExclusionRemoveBothSides')}
                </button>
              </div>
            </div>
          ) : (
            <div key={index} className="space-y-1">
            <div className="flex gap-2 items-center">
              <span>
                {rule.type === 'must' 
                  ? t('rules.mustBePairedWith')
                  : t('rules.mustNotBePairedWith')
                }
              </span>
              <select
                value={rule.targetParticipantId}
                onChange={(e) => updateRule(index, e.target.value)}
                className="flex-1 p-2 border rounded"
              >
                <option value="">{t('rules.selectParticipant')}</option>
                {Object.values(participants)
                  .filter(p => p.id !== participantId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                }
              </select>
              <button
                onClick={() => requestRemoveRule(index)}
                className="p-2 text-red-500 hover:text-red-700"
                aria-label={t('rules.removeRule')}
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            {rule.type === 'mustNot' && (() => {
              const unavailable = rule.targetParticipantId !== '' && hasReverseMust(rule.targetParticipantId);
              return (
                <label className={`flex items-center gap-2 text-sm pl-1 ${unavailable ? 'text-gray-400' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={rule.bothWays && !unavailable}
                    disabled={unavailable}
                    onChange={(e) => setBothWays(index, e.target.checked)}
                  />
                  {unavailable
                    ? t('rules.mutualExclusionUnavailable', { other: participants[rule.targetParticipantId]?.name ?? '' })
                    : t('rules.mutualExclusion')}
                </label>
              );
            })()}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => addRule('must')}
            disabled={hasMustNotRule}
            className={`flex-1 p-2 rounded flex items-center justify-center gap-2
              ${hasMustNotRule 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'} text-white`}
          >
            <Link size={20} />
            {t('rules.addMustRule')}
          </button>
          <button
            onClick={() => addRule('mustNot')}
            disabled={hasMustRule}
            className={`flex-1 p-2 rounded flex items-center justify-center gap-2
              ${hasMustRule 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-red-500 hover:bg-red-600'} text-white`}
          >
            <LinkBreak size={20} />
            {t('rules.addMustNotRule')}
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {t('rules.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {t('rules.saveRules')}
          </button>
        </div>
      </div>
    </div>
  );
} 
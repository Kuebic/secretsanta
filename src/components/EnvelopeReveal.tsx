import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface EnvelopeRevealProps {
  receiverName: string;
}

// The Reveal: the flap folds open and a card carrying the receiver's name
// slides out of the envelope.
export function EnvelopeReveal({ receiverName }: EnvelopeRevealProps) {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-xs pt-24" style={{ perspective: 800 }} aria-label={t('participant.envelope')}>
      <motion.div
        className="absolute left-4 right-4 bottom-4 z-10 p-4 bg-white border border-gray-200 rounded shadow text-center"
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: -88, opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.7, ease: 'easeOut' }}
      >
        <p className="text-sm text-gray-600">{t('participant.youGiveTo')}</p>
        <p className="text-2xl font-bold text-red-700 break-words" data-testid="receiver-name">{receiverName}</p>
      </motion.div>
      <div className="relative h-36 bg-red-700 rounded-b-md">
        <div
          className="absolute inset-0 z-20 rounded-b-md bg-red-800"
          style={{ clipPath: 'polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)' }}
        />
        <motion.div
          className="absolute left-0 right-0 top-0 h-20 bg-red-900 origin-top"
          style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', zIndex: 30 }}
          initial={{ rotateX: 0 }}
          animate={{ rotateX: 180, zIndex: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

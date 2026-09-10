import { useState } from 'react';
import { X, MessageSquareWarning, Send, CheckCircle2, Clock, Users } from 'lucide-react';
import { SEVERITY_COLOR } from '../lib/simulation.js';
import { triggerAlertBroadcast } from '../lib/actionCenter.js';

const SEVERITY_LABEL = { normal: 'Normal', caution: 'Caution', critical: 'Critical' };

function formatEta(minutes) {
  if (minutes === null) return 'Not expected in window';
  if (minutes <= 0) return 'Now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

function WardCard({ ward }) {
  return (
    <div className="rounded border border-hairline bg-canvas p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink dark:text-slate-100">{ward.name}</p>
        <span
          className="rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ color: SEVERITY_COLOR[ward.currentSeverity], background: `${SEVERITY_COLOR[ward.currentSeverity]}1a` }}
        >
          {SEVERITY_LABEL[ward.currentSeverity]} now
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between text-ink-muted dark:text-slate-400">
          <dt className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Time to critical
          </dt>
          <dd className="data-readout font-medium" style={{ color: ward.etaToCriticalMinutes !== null ? SEVERITY_COLOR.critical : undefined }}>
            {formatEta(ward.etaToCriticalMinutes)}
          </dd>
        </div>
        <div className="flex items-center justify-between text-ink-muted dark:text-slate-400">
          <dt className="flex items-center gap-1">
            <Users className="h-3 w-3" /> Est. population
          </dt>
          <dd className="data-readout text-ink dark:text-slate-200">{ward.estimatedPopulation.toLocaleString('en-IN')}</dd>
        </div>
        <div className="flex items-center justify-between text-ink-muted dark:text-slate-400">
          <dt>Peak risk (0–3hr)</dt>
          <dd className="font-medium" style={{ color: SEVERITY_COLOR[ward.peakSeverity] }}>
            {SEVERITY_LABEL[ward.peakSeverity]}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function ActionCenterModal({ bulletin, onClose }) {
  const [broadcastState, setBroadcastState] = useState('idle'); // idle | sending | sent
  const [receipt, setReceipt] = useState(null);

  const handleBroadcast = async () => {
    setBroadcastState('sending');
    const result = await triggerAlertBroadcast(bulletin.wards);
    setReceipt(result);
    setBroadcastState('sent');
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-md border border-hairline bg-canvas shadow-panel dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-risk-critical" />
            <p className="text-sm font-semibold text-ink dark:text-slate-100">Pre-Flood Action Bulletin</p>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-slate-200" aria-label="Close bulletin">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-xs text-ink-muted dark:text-slate-400">
            Auto-generated 0–3hr risk-by-ward assessment for disaster management, computed from the current
            nowcast at t = +{Math.floor(bulletin.generatedAtMinutes / 60)}h{' '}
            {bulletin.generatedAtMinutes % 60}m. Ranked most urgent first.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bulletin.wards.map((w) => (
              <WardCard key={w.id} ward={w} />
            ))}
          </div>

          <div className="mt-4 rounded border border-hairline-strong bg-panel p-3 dark:border-slate-700 dark:bg-slate-900">
            {broadcastState !== 'sent' ? (
              <>
                <p className="text-xs text-ink-muted dark:text-slate-400">
                  Sends an evacuation/preparedness advisory to every ward at caution-or-above risk in this
                  window, via the municipal disaster-management gateway.
                </p>
                <button
                  onClick={handleBroadcast}
                  disabled={broadcastState === 'sending'}
                  className="mt-2 flex items-center gap-1.5 rounded border border-risk-critical bg-red-50 px-3 py-1.5 text-xs font-semibold text-risk-critical transition-colors hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/40 dark:hover:bg-red-950/60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {broadcastState === 'sending' ? 'Sending broadcast…' : 'Send WhatsApp/SMS Alert Broadcast'}
                </button>
              </>
            ) : (
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium text-ink dark:text-slate-100">Broadcast sent (simulated)</p>
                  <p className="mt-0.5 text-ink-muted dark:text-slate-400">
                    Reached an estimated {receipt.recipientHouseholds.toLocaleString('en-IN')} households across{' '}
                    {receipt.wardsNotified.length} ward(s) via {receipt.channel}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { X, Camera, MapPin, Send } from 'lucide-react';

export default function HazardReportDrawer({ nodeOptions, onClose, onSubmit }) {
  const [nodeId, setNodeId] = useState(nodeOptions[0]?.id ?? '');
  const [depthCm, setDepthCm] = useState(20);
  const [note, setNote] = useState('');
  const [photoName, setPhotoName] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const node = nodeOptions.find((n) => n.id === nodeId);
    if (!node) return;
    onSubmit({
      id: `RPT-${Date.now()}`,
      nodeId,
      lat: node.lat,
      lng: node.lng,
      depthCm: Number(depthCm),
      note,
      photoName,
      reportedAt: new Date().toISOString(),
    });
    setSubmitted(true);
    setTimeout(onClose, 1100);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="theme-transition h-full w-full max-w-sm overflow-y-auto border-l border-hairline bg-canvas shadow-panel dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-ink dark:text-slate-100">Report a flooding hazard</p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-slate-200" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-4 text-sm text-emerald-600">
            Thanks — your report was dropped on the live map for other citizens and the municipal team to see.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 p-4 text-xs">
            <p className="text-ink-muted dark:text-slate-400">
              Simulated real-time ground report — for the hackathon demo this drops a pin immediately on the
              map canvas. In production this would post to a citizen-reporting API.
            </p>

            <label className="block text-ink-muted dark:text-slate-400">
              <span className="mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Nearest intersection
              </span>
              <select
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="w-full rounded border border-hairline-strong bg-canvas px-2 py-1.5 text-ink dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {nodeOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id} · {n.type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-ink-muted dark:text-slate-400">
              <span className="mb-1 flex items-center justify-between">
                <span>Estimated water depth</span>
                <span className="data-readout font-medium text-ink dark:text-slate-200">{depthCm} cm</span>
              </span>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={depthCm}
                onChange={(e) => setDepthCm(e.target.value)}
                className="h-1 w-full cursor-pointer accent-water-500"
              />
            </label>

            <label className="block text-ink-muted dark:text-slate-400">
              <span className="mb-1 flex items-center gap-1">
                <Camera className="h-3 w-3" /> Photo (simulated upload)
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
                className="block w-full text-[11px] text-ink-faint file:mr-2 file:rounded file:border-0 file:bg-water-50 file:px-2 file:py-1 file:text-water-600 dark:file:bg-water-500/10 dark:file:text-water-300"
              />
            </label>

            <label className="block text-ink-muted dark:text-slate-400">
              Note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. water rising fast near the market entrance"
                className="mt-1 w-full rounded border border-hairline-strong bg-canvas px-2 py-1.5 text-ink dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded border border-water-500 bg-water-50 py-1.5 text-xs font-semibold text-water-600 hover:bg-water-100 dark:bg-water-500/10 dark:text-water-300 dark:hover:bg-water-500/20"
            >
              <Send className="h-3.5 w-3.5" /> Submit report
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { DetailedDeliveryQueueItem, DeliveryStatus } from '../../types/communication';
import { INITIAL_DETAILED_DELIVERY_QUEUE } from '../../data/communicationExtendedSeed';
import {
  Layers,
  Mail,
  MessageSquare,
  Bell,
  RefreshCw,
  Play,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface DeliveryQueuesViewProps {
  initialChannelFilter?: 'ALL' | 'EMAIL' | 'WHATSAPP';
}

export const DeliveryQueuesView: React.FC<DeliveryQueuesViewProps> = ({
  initialChannelFilter = 'ALL',
}) => {
  const [queueItems, setQueueItems] = useState<DetailedDeliveryQueueItem[]>(INITIAL_DETAILED_DELIVERY_QUEUE);
  const [channelTab, setChannelTab] = useState<'ALL' | 'EMAIL' | 'WHATSAPP' | 'DEAD_LETTER'>(
    initialChannelFilter === 'EMAIL' ? 'EMAIL' : initialChannelFilter === 'WHATSAPP' ? 'WHATSAPP' : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForInspect, setSelectedItemForInspect] = useState<DetailedDeliveryQueueItem | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const filteredItems = queueItems.filter((item) => {
    if (channelTab === 'DEAD_LETTER') {
      if (item.status !== 'DEAD_LETTER' && item.status !== 'FAILED') return false;
    } else if (channelTab !== 'ALL') {
      if (item.channel !== channelTab) return false;
    }

    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

    if (
      searchQuery &&
      !item.recipient.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.correlationId.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.subject.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const handleManualRetry = (id: string) => {
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'PROCESSING',
              retryCount: item.retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
              errorMessage: undefined,
            }
          : item
      )
    );
    setActionSuccessNotice(`Message [${id}] requeued for immediate worker processing.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const handleReprocessDeadLetter = (id: string) => {
    setQueueItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'QUEUED',
              retryCount: 0,
              errorMessage: undefined,
              errorCode: undefined,
            }
          : item
      )
    );
    setActionSuccessNotice(`Dead-letter job [${id}] reprocessed and returned to active dispatch queue.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const handleCancelJob = (id: string) => {
    setQueueItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'CANCELLED' } : item))
    );
    setActionSuccessNotice(`Message [${id}] cancelled by operator.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Queue & Dead-Letter Hub</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Durable queued messages, exponential retry schedules, dead-letter recovery, and idempotency tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Worker Status:</span>
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            4 Background Workers Active
          </span>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* Tabs and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Channel Queue Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setChannelTab('ALL')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition ${
              channelTab === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unified Queue ({queueItems.length})
          </button>
          <button
            onClick={() => setChannelTab('EMAIL')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
              channelTab === 'EMAIL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Queue</span>
          </button>
          <button
            onClick={() => setChannelTab('WHATSAPP')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
              channelTab === 'WHATSAPP' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Queue</span>
          </button>
          <button
            onClick={() => setChannelTab('DEAD_LETTER')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
              channelTab === 'DEAD_LETTER' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Dead-Letter & Retries</span>
          </button>
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium"
          >
            <option value="ALL">All Delivery Statuses</option>
            <option value="QUEUED">QUEUED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="READ">READ</option>
            <option value="FAILED">FAILED</option>
            <option value="DEAD_LETTER">DEAD_LETTER</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient or correlation ID..."
              className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 w-52 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Channel & Recipient</th>
                <th className="px-4 py-3">Subject / Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Timestamps</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No delivery jobs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`p-1.5 rounded-lg ${
                            item.channel === 'EMAIL' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.channel === 'EMAIL' ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{item.recipientName}</div>
                          <div className="text-[11px] font-mono text-slate-500">{item.recipient}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate">{item.subject}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.eventCode} • {item.correlationId}
                      </div>
                      {item.errorMessage && (
                        <div className="text-[10px] text-red-600 font-medium truncate mt-0.5" title={item.errorMessage}>
                          Error: {item.errorMessage}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.status === 'DELIVERED' || item.status === 'READ'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PROCESSING'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : item.status === 'QUEUED'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'DEAD_LETTER'
                            ? 'bg-red-100 text-red-800 font-bold'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs">
                        <span className={item.retryCount >= item.maxRetries ? 'text-red-600 font-bold' : 'text-slate-800'}>
                          {item.retryCount}
                        </span>
                        <span className="text-slate-400">/{item.maxRetries} max</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                      <div>Created: {new Date(item.createdAt).toLocaleTimeString()}</div>
                      {item.lastAttemptAt && (
                        <div>Attempted: {new Date(item.lastAttemptAt).toLocaleTimeString()}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedItemForInspect(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                          title="Inspect Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(item.status === 'FAILED' || item.status === 'DEAD_LETTER') && (
                          <button
                            onClick={() => handleReprocessDeadLetter(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-xs"
                            title="Reprocess Dead-Letter"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reprocess</span>
                          </button>
                        )}

                        {item.status === 'QUEUED' && (
                          <button
                            onClick={() => handleManualRetry(item.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-xs"
                            title="Retry Now"
                          >
                            <Play className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        )}

                        {item.status !== 'CANCELLED' && item.status !== 'DELIVERED' && item.status !== 'READ' && (
                          <button
                            onClick={() => handleCancelJob(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            title="Cancel Job"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Payload Modal */}
      {selectedItemForInspect && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Delivery Intent Snapshot Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedItemForInspect(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div><strong>Queue ID:</strong> <code className="font-mono">{selectedItemForInspect.id}</code></div>
                <div><strong>Correlation ID:</strong> <code className="font-mono">{selectedItemForInspect.correlationId}</code></div>
                <div><strong>Idempotency Key:</strong> <code className="font-mono">{selectedItemForInspect.idempotencyKey}</code></div>
                <div><strong>Recipient:</strong> {selectedItemForInspect.recipientName} ({selectedItemForInspect.recipient})</div>
                <div><strong>Channel:</strong> {selectedItemForInspect.channel}</div>
                <div><strong>Provider Receipt:</strong> {selectedItemForInspect.providerReceiptId || 'Pending Provider Ack'}</div>
              </div>

              {selectedItemForInspect.errorMessage && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Error Code: {selectedItemForInspect.errorCode || 'DELIVERY_FAILURE'}</span>
                  </div>
                  <div className="font-mono text-[11px]">{selectedItemForInspect.errorMessage}</div>
                </div>
              )}

              <div className="border border-slate-200 p-3 rounded-lg">
                <div className="font-bold text-slate-800 mb-1">Message Preview Content</div>
                <div className="text-slate-600 text-xs leading-relaxed">{selectedItemForInspect.previewText}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItemForInspect(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

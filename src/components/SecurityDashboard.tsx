import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  adminSecurityAction,
  getSeverityColor,
  getTriggerTypeLabel,
  getAccountStatusLabel,
  getAccountStatusColor,
  type SecurityFlag,
  type SecuritySeverity,
  type TriggerType,
} from '@/lib/security';
import type { Profile } from '@/lib/types';
import {
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Check, X, Ban,
  Unlock, Eye, Loader2, ChevronDown, ChevronUp, UserX, Smartphone,
} from 'lucide-react';

export function SecurityDashboardTab() {
  const { profile } = useAuth();
  const [flags, setFlags] = useState<SecurityFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'PENDING_REVIEW' | 'RESOLVED' | 'BANNED'>('PENDING_REVIEW');
  const [userMap, setUserMap] = useState<Record<string, Profile>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deviceMap, setDeviceMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    let query = supabase.from('security_flags').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    const flagData = (data || []) as SecurityFlag[];
    setFlags(flagData);

    const userIds = [...new Set(flagData.map(f => f.user_id).filter(Boolean) as string[])];
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('profiles').select('*').in('id', userIds);
      const map: Record<string, Profile> = {};
      (users || []).forEach((u: Profile) => { map[u.id] = u; });
      setUserMap(map);

      const { data: devices } = await supabase.from('user_devices').select('user_id, device_id').in('user_id', userIds);
      const dMap: Record<string, string> = {};
      (devices || []).forEach((d: { user_id: string; device_id: string }) => { dMap[d.user_id] = d.device_id; });
      setDeviceMap(dMap);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel('security-flags-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'security_flags' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  async function handleAction(flagId: string, action: 'dismiss' | 'lift' | 'ban', deviceId?: string) {
    if (!profile) return;
    setActionLoading(flagId + action);
    await adminSecurityAction(flagId, profile.id, action, deviceId);
    setActionLoading(null);
    setExpandedFlag(null);
    await load();
  }

  const severityOrder: Record<SecuritySeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortedFlags = [...flags].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const stats = {
    total: flags.length,
    high: flags.filter(f => f.severity === 'HIGH' && f.status === 'PENDING_REVIEW').length,
    medium: flags.filter(f => f.severity === 'MEDIUM' && f.status === 'PENDING_REVIEW').length,
    pending: flags.filter(f => f.status === 'PENDING_REVIEW').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert size={24} className="text-red-600" />
        <h2 className="text-lg font-bold text-gray-800">Security Dashboard</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-100 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.high}</p>
          <p className="text-xs text-red-500">High Priority</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.medium}</p>
          <p className="text-xs text-amber-500">Medium</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          <p className="text-xs text-blue-500">Pending</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['PENDING_REVIEW', 'RESOLVED', 'BANNED', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'PENDING_REVIEW' ? 'Pending Review' : f === 'RESOLVED' ? 'Resolved' : 'Banned'}
          </button>
        ))}
      </div>

      {/* Flags Feed */}
      {sortedFlags.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck size={48} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm text-gray-400">No security flags found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFlags.map(flag => {
            const user = flag.user_id ? userMap[flag.user_id] : null;
            const deviceId = flag.user_id ? deviceMap[flag.user_id] : undefined;
            const isExpanded = expandedFlag === flag.id;
            const isLoading = actionLoading === flag.id + 'dismiss' || actionLoading === flag.id + 'lift' || actionLoading === flag.id + 'ban';

            return (
              <div key={flag.id} className={`bg-white rounded-2xl border-2 ${flag.severity === 'HIGH' ? 'border-red-200' : flag.severity === 'MEDIUM' ? 'border-amber-200' : 'border-gray-100'} overflow-hidden`}>
                {/* Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedFlag(isExpanded ? null : flag.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        flag.severity === 'HIGH' ? 'bg-red-100' : flag.severity === 'MEDIUM' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {flag.severity === 'HIGH' ? <ShieldX size={20} className="text-red-600" /> :
                         flag.severity === 'MEDIUM' ? <AlertTriangle size={20} className="text-amber-600" /> :
                         <ShieldAlert size={20} className="text-blue-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-800">{getTriggerTypeLabel(flag.trigger_type as TriggerType)}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {user ? user.full_name : 'System'} · {new Date(flag.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityColor(flag.severity as SecuritySeverity)}`}>
                        {flag.severity}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        flag.status === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-700' :
                        flag.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {flag.status === 'PENDING_REVIEW' ? 'Pending' : flag.status === 'RESOLVED' ? 'Resolved' : 'Banned'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    {/* User Info */}
                    {user && (
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">User:</span>
                          <span className="text-sm text-gray-800">{user.full_name} ({user.email})</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getAccountStatusColor(user.account_status)}`}>
                          {getAccountStatusLabel(user.account_status)}
                        </span>
                      </div>
                    )}

                    {/* Device Info */}
                    {deviceId && (
                      <div className="mb-3 flex items-center gap-2">
                        <Smartphone size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-500">Device: {deviceId}</span>
                      </div>
                    )}

                    {/* Actions Taken */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Actions Taken:</p>
                      <div className="flex flex-wrap gap-1">
                        {(flag.actions_taken || []).map((a, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-gray-200 rounded-full text-gray-700">{a}</span>
                        ))}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Details:</p>
                      <pre className="text-xs text-gray-600 bg-white rounded-xl p-3 overflow-x-auto border border-gray-100">
                        {JSON.stringify(flag.details, null, 2)}
                      </pre>
                    </div>

                    {/* Admin Actions */}
                    {flag.status === 'PENDING_REVIEW' && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleAction(flag.id, 'dismiss')}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Dismiss Flag
                        </button>
                        <button
                          onClick={() => handleAction(flag.id, 'lift')}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                          Lift Suspension
                        </button>
                        <button
                          onClick={() => handleAction(flag.id, 'ban', deviceId)}
                          disabled={isLoading || !deviceId}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold active:scale-95 transition disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                          Ban User & Device
                        </button>
                      </div>
                    )}

                    {/* Review Chat Logs */}
                    {flag.trigger_type === 'OFF_PLATFORM_POACHING' && flag.user_id && (
                      <a
                        href={`#`}
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`Chat logs available in Messages tab. Conversation ID: ${(flag.details as any).conversation_id}`);
                        }}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 font-medium"
                      >
                        <Eye size={14} /> Review Chat Logs
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

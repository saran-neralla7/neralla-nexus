'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { formatDateTime } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import { fetchAuditLogs } from './actions';

export default function AuditLogsPage() {
  const { user } = useUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');

  // Details Modal State
  const [activeLog, setActiveLog] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Only owners can fetch audit logs
    if (user.role === 'owner' || user.is_owner) {
      startTransition(async () => {
        try {
          const fetchedLogs = await fetchAuditLogs();
          setLogs(fetchedLogs);
        } catch (err) {
          // Access denied or database error
          console.error(err);
        } finally {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  // Authorization Check
  const isOwner = user?.role === 'owner' || user?.is_owner;

  // Resource types list for filtering
  const resourceTypes = [
    { id: 'all', label: 'All Resources' },
    { id: 'vault', label: 'Vault' },
    { id: 'passwords', label: 'Passwords' },
    { id: 'documents', label: 'Documents' },
    { id: 'policies', label: 'Policies' },
    { id: 'medical', label: 'Medical' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'assets', label: 'Assets' },
    { id: 'memories', label: 'Memories' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'settings', label: 'Settings' },
    { id: 'trash', label: 'Trash' },
  ];

  // Extract unique operators (users) for dropdown filtering
  const uniqueUsers = Array.from(
    new Map(
      logs
        .filter((l) => l.users)
        .map((l) => [l.user_id, l.users])
    ).entries()
  );

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.users?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesResource =
      selectedResourceType === 'all' ||
      log.resource_type.toLowerCase() === selectedResourceType.toLowerCase() ||
      (selectedResourceType === 'vault' &&
        ['passwords', 'documents', 'policies'].includes(log.resource_type.toLowerCase()));

    const matchesUser =
      selectedUser === 'all' || log.user_id === selectedUser;

    return matchesSearch && matchesResource && matchesUser;
  });

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('purge') || act.includes('remove') || act.includes('clear')) {
      return 'rgba(255,180,171,0.12) text-[#ffb4ab] border-red-500/20'; // Error / Destructive
    }
    if (act.includes('create') || act.includes('insert') || act.includes('add') || act.includes('save') || act.includes('setup')) {
      return 'rgba(79,219,200,0.12) text-[#4fdbc8] border-teal-500/20'; // Success / Primary
    }
    if (act.includes('update') || act.includes('edit') || act.includes('change') || act.includes('restore')) {
      return 'rgba(255,181,158,0.12) text-[#ffb59e] border-orange-400/20'; // Accent / Warn
    }
    if (act.includes('view') || act.includes('reveal') || act.includes('read') || act.includes('download') || act.includes('export')) {
      return 'rgba(173,198,255,0.12) text-[#adc6ff] border-blue-400/20'; // Secondary
    }
    return 'rgba(255,255,255,0.06) text-[#bbcac6] border-white/10'; // Default
  };

  const getResourceIcon = (resType: string) => {
    switch (resType.toLowerCase()) {
      case 'passwords':
        return 'password';
      case 'documents':
        return 'description';
      case 'policies':
        return 'shield_heart';
      case 'medical':
        return 'medical_services';
      case 'contacts':
        return 'contact_phone';
      case 'assets':
        return 'inventory_2';
      case 'memories':
        return 'photo_library';
      case 'calendar':
        return 'calendar_month';
      case 'emergency':
        return 'warning';
      case 'settings':
        return 'settings';
      case 'trash':
        return 'delete';
      default:
        return 'history';
    }
  };

  const handleOpenDetails = (log: any) => {
    setActiveLog(log);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-[#859490]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8] mb-2">
          progress_activity
        </span>
        <p className="text-body-md">Retrieving security audit logs...</p>
      </div>
    );
  }

  // Access Denied screen for non-owners
  if (!isOwner) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-2xl mx-auto text-center space-y-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
          style={{ background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)' }}
        >
          <span className="material-symbols-outlined text-[#ffb4ab]" style={{ fontSize: '42px', fontVariationSettings: "'FILL' 1" }}>
            gavel
          </span>
        </div>

        <div className="space-y-2">
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '28px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            Access Denied
          </h1>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Only the primary family owner is authorized to view security audit logs. If you require security compliance access, please contact the family owner.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-[#14b8a6] to-[#0566d9] text-white font-semibold rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className="material-symbols-outlined text-[30px]"
            style={{ color: '#4fdbc8', fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            Audit Logs & Security Compliance
          </h1>
        </div>
        <p className="text-body-md" style={{ color: '#859490' }}>
          Real-time, immutable security audit trail logging family records modifications, security settings changes, and emergency broadcasts.
        </p>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          {/* Search */}
          <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
            <span className="material-symbols-outlined text-sm text-[#859490] mr-2">search</span>
            <input
              type="text"
              placeholder="Search logs by action, user, metadata..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-sm text-[#dde4e1] placeholder:text-[#859490]/50 w-full"
            />
          </div>

          {/* User selector */}
          <div className="w-full sm:w-60 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1">
            <span className="material-symbols-outlined text-sm text-[#859490] mr-2 pl-1">person</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-sm text-[#dde4e1] w-full cursor-pointer pr-4"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" className="bg-[#0e1513]">All Operators</option>
              {uniqueUsers.map(([id, u]: any) => (
                <option key={id} value={id} className="bg-[#0e1513]">
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Horizontal scrollable resource tags */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
          {resourceTypes.map((res) => (
            <button
              key={res.id}
              onClick={() => setSelectedResourceType(res.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedResourceType === res.id
                  ? 'bg-[#4fdbc8] text-[#003731]'
                  : 'text-[#bbcac6] hover:bg-white/5 bg-white/[0.02] border border-white/5'
              }`}
            >
              {res.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      {filteredLogs.length === 0 ? (
        <div className="py-20 text-center border border-white/5 rounded-2xl bg-white/[0.01] space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#859490]">
            <span className="material-symbols-outlined text-[30px]">receipt_long</span>
          </div>
          <h3
            className="text-lg font-semibold text-[#dde4e1]"
            style={{ fontFamily: 'Geist, sans-serif' }}
          >
            No Audit Logs Found
          </h3>
          <p className="text-xs text-[#859490] max-w-sm mx-auto leading-relaxed">
            No entries match your search keywords or resource filters, or the audit log database table is currently empty.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (hidden on md and up) */}
          <div className="md:hidden space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[#4fdbc8] text-[20px] flex-shrink-0">
                      {getResourceIcon(log.resource_type)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-[#dde4e1] break-all">{log.action}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize whitespace-nowrap ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.resource_type}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#859490] mt-1">
                        By {log.users?.full_name || 'System'} • {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenDetails(log)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#4fdbc8] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Inspect Metadata
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden on mobile) */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[#859490] bg-white/[0.01]">
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Operator</th>
                    <th className="px-6 py-4">Activity / Action</th>
                    <th className="px-6 py-4">Resource</th>
                    <th className="px-6 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-[#859490] whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-[#dde4e1]">
                          {log.users?.full_name || 'System'}
                        </div>
                        <div className="text-[10px] text-[#859490]">
                          {log.users?.email || 'automated@nexus.local'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#bbcac6] capitalize">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#4fdbc8] text-[18px]">
                            {getResourceIcon(log.resource_type)}
                          </span>
                          {log.resource_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDetails(log)}
                          className="py-1 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[#4fdbc8] rounded-lg text-xs font-bold transition-all"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* METADATA INSPECT MODAL */}
      <NexusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="🕵️ Security Log Detail Inspector"
      >
        {activeLog && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">Action Taken</h4>
                  <p className="text-body-sm font-semibold text-[#dde4e1] mt-0.5">{activeLog.action}</p>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">Resource Layer</h4>
                  <p className="text-body-sm font-semibold text-[#dde4e1] mt-0.5 capitalize">{activeLog.resource_type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">Operator User</h4>
                  <p className="text-body-sm font-semibold text-[#dde4e1] mt-0.5">{activeLog.users?.full_name || 'System'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">IP Address</h4>
                  <p className="text-body-sm font-semibold text-[#dde4e1] mt-0.5">{activeLog.ip_address || 'Unavailable'}</p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3">
                <h4 className="text-[10px] uppercase tracking-wider text-[#859490] font-bold">Execution Date & Time</h4>
                <p className="text-body-sm font-semibold text-[#dde4e1] mt-0.5">{formatDateTime(activeLog.created_at)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-label-sm text-[#bbcac6]">Log Event Metadata JSON</h4>
              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#090f0e] p-4 font-mono text-[11px] text-teal-400 overflow-x-auto max-h-60 custom-scrollbar">
                <pre>{JSON.stringify(activeLog.metadata || {}, null, 2)}</pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="py-2.5 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#dde4e1] font-semibold rounded-xl text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </NexusModal>
    </div>
  );
}

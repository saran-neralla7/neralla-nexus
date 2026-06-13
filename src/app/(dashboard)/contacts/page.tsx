'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { TrustedContact, ContactCategory } from '@/types';
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
} from './actions';

const CATEGORY_MAP: Record<ContactCategory, { label: string; icon: string; color: string }> = {
  bank_manager: { label: 'Bank Manager', icon: 'account_balance', color: '#adc6ff' },
  insurance_agent: { label: 'Insurance Agent', icon: 'shield', color: '#ffb59e' },
  doctor: { label: 'Doctor', icon: 'medical_services', color: '#4fdbc8' },
  lawyer: { label: 'Lawyer', icon: 'gavel', color: '#c084fc' },
  accountant: { label: 'Accountant', icon: 'payments', color: '#a7f3d0' },
  mechanic: { label: 'Mechanic', icon: 'build', color: '#fb923c' },
  electrician: { label: 'Electrician', icon: 'bolt', color: '#fde047' },
  plumber: { label: 'Plumber', icon: 'water_drop', color: '#60a5fa' },
  other: { label: 'Other Contact', icon: 'person', color: '#859490' },
};

const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: 'groups' },
  { id: 'emergency', label: 'Emergency', icon: 'emergency' },
  { id: 'bank_manager', label: 'Banks', icon: 'account_balance' },
  { id: 'insurance_agent', label: 'Insurance', icon: 'shield' },
  { id: 'doctor', label: 'Doctors', icon: 'medical_services' },
  { id: 'lawyer', label: 'Lawyers', icon: 'gavel' },
  { id: 'accountant', label: 'Finance', icon: 'payments' },
  { id: 'utilities', label: 'Services', icon: 'construction' }, // groups mechanic, electrician, plumber
  { id: 'other', label: 'Others', icon: 'person' },
];

export default function ContactsPage() {
  const { user } = useUser();
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ContactCategory>('other');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsEmergency, setFormIsEmergency] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const data = await fetchContacts();
      setContacts(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormCategory('other');
    setFormPhone('');
    setFormEmail('');
    setFormCompany('');
    setFormNotes('');
    setFormIsEmergency(false);
    setShowFormModal(true);
  };

  const openEditModal = (contact: TrustedContact) => {
    setEditingId(contact.id);
    setFormName(contact.name);
    setFormCategory(contact.category);
    setFormPhone(contact.phone || '');
    setFormEmail(contact.email || '');
    setFormCompany(contact.company || '');
    setFormNotes(contact.notes || '');
    setFormIsEmergency(contact.is_emergency);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: formName,
          category: formCategory,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          company: formCompany || undefined,
          notes: formNotes || undefined,
          is_emergency: formIsEmergency,
        };

        if (editingId) {
          await updateContact(editingId, payload);
          toast.success('Contact updated successfully');
        } else {
          await createContact(payload);
          toast.success('Contact created successfully');
        }

        setShowFormModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save contact');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteContact(deleteId);
      toast.success('Contact deleted successfully');
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete contact');
    }
  };

  // Filter logic
  const filteredContacts = contacts.filter((c) => {
    // Search query match
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(searchLower) ||
      (c.company && c.company.toLowerCase().includes(searchLower)) ||
      (c.phone && c.phone.includes(searchLower)) ||
      (c.email && c.email.toLowerCase().includes(searchLower)) ||
      (c.notes && c.notes.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    // Tab filter match
    if (activeTab === 'all') return true;
    if (activeTab === 'emergency') return c.is_emergency;
    if (activeTab === 'utilities') {
      return ['mechanic', 'electrician', 'plumber'].includes(c.category);
    }
    return c.category === activeTab;
  });

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined"
              style={{ color: '#4fdbc8', fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
            >
              contact_phone
            </span>
            <h1
              className="text-headline-lg"
              style={{
                fontFamily: 'Geist, sans-serif',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Trusted Contacts
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Maintain a secure network of family members, advisors, and service professionals.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
            color: '#ffffff',
            boxShadow: '0 4px 20px rgba(20, 184, 166, 0.25)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Contact
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none mask-image-right">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? 'rgba(79, 219, 200, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${activeTab === tab.id ? 'rgba(79, 219, 200, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                color: activeTab === tab.id ? '#4fdbc8' : '#bbcac6',
              }}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : undefined }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px]"
            style={{ color: '#859490' }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search by name, company, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#859490] hover:text-[#dde4e1]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <span className="material-symbols-outlined animate-spin text-[40px] text-[#4fdbc8]">
            progress_activity
          </span>
          <p className="text-body-md" style={{ color: '#859490' }}>Loading contacts database...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center max-w-xl mx-auto space-y-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          >
            <span className="material-symbols-outlined text-[32px] text-[#859490]">
              contact_support
            </span>
          </div>
          <div>
            <h3 className="text-headline-sm font-semibold text-[#dde4e1] mb-2">No Contacts Found</h3>
            <p className="text-body-sm text-[#859490]">
              {searchQuery || activeTab !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first trusted contact or emergency professional.'}
            </p>
          </div>
          {(searchQuery || activeTab !== 'all') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="px-5 py-2.5 rounded-xl font-medium text-body-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#bbcac6',
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="px-5 py-2.5 rounded-xl font-medium text-body-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                color: 'white',
              }}
            >
              Create Contact
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => {
            const cat = CATEGORY_MAP[contact.category] || CATEGORY_MAP.other;
            const initials = getInitials(contact.name);
            const avatarBg = getAvatarStyle(contact.name);

            return (
              <div
                key={contact.id}
                className={`glass-card rounded-2xl p-6 relative flex flex-col justify-between transition-all duration-300 ${
                  contact.is_emergency ? 'border-red-500/25 shadow-[0_4px_20px_rgba(244,63,94,0.08)]' : ''
                }`}
                style={{
                  border: contact.is_emergency
                    ? '1px solid rgba(244, 63, 94, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Card Header */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-headline-sm shrink-0"
                        style={{ background: avatarBg }}
                      >
                        {initials}
                      </div>

                      <div>
                        <h3 className="font-heading font-semibold text-[#dde4e1] text-[17px] line-clamp-1">
                          {contact.name}
                        </h3>
                        {contact.company && (
                          <p className="text-body-sm text-[#859490] line-clamp-1">{contact.company}</p>
                        )}
                      </div>
                    </div>

                    {/* Emergency Indicator */}
                    {contact.is_emergency && (
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-semibold shrink-0"
                        style={{
                          background: 'rgba(244, 63, 94, 0.1)',
                          border: '1px solid rgba(244, 63, 94, 0.2)',
                          color: '#f43f5e',
                          fontSize: '10px',
                        }}
                      >
                        <span className="material-symbols-outlined text-[12px]">emergency</span>
                        SOS
                      </span>
                    )}
                  </div>

                  {/* Category Tag */}
                  <div className="flex">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-label-sm font-medium"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: cat.color,
                        fontSize: '11px',
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                      {cat.label}
                    </span>
                  </div>

                  {/* Notes / Subtitle */}
                  {contact.notes && (
                    <p className="text-body-sm text-[#859490] line-clamp-2 italic bg-white/[0.01] p-2.5 rounded-xl border border-white/[0.02]">
                      "{contact.notes}"
                    </p>
                  )}
                </div>

                {/* Card Contact Info & Actions */}
                <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
                  {/* Info lines */}
                  <div className="space-y-2.5">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2.5 text-body-sm text-[#bbcac6] hover:text-[#4fdbc8] transition-colors w-fit group"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#859490] group-hover:text-[#4fdbc8]">
                          phone
                        </span>
                        <span>{contact.phone}</span>
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2.5 text-body-sm text-[#bbcac6] hover:text-[#4fdbc8] transition-colors w-fit group"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#859490] group-hover:text-[#4fdbc8]">
                          mail
                        </span>
                        <span className="truncate max-w-[220px]">{contact.email}</span>
                      </a>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 justify-end pt-1">
                    <button
                      onClick={() => openEditModal(contact)}
                      className="p-2.5 rounded-xl hover:bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] transition-all"
                      title="Edit Contact"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteId(contact.id)}
                      className="p-2.5 rounded-xl hover:bg-[#93000a]/10 text-[#bbcac6] hover:text-[#ffb4ab] transition-all"
                      title="Delete Contact"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingId ? 'Edit Trusted Contact' : 'Add New Contact'}
        description={editingId ? 'Modify contact details and preferences.' : 'Keep a record of a service professional or emergency contact.'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Ramesh Neralla"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ContactCategory)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] bg-[#1a211f]"
              >
                {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
                  <option key={key} value={key} className="bg-[#1a211f] text-[#dde4e1]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Company / Hospital / Bank</label>
              <input
                type="text"
                placeholder="e.g. Apollo Hospital"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="e.g. doctor@hospital.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5">Notes / Specialties / Availability</label>
            <textarea
              placeholder="e.g. Available 24/7 for pediatric queries."
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] resize-none"
            />
          </div>

          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{
              background: formIsEmergency ? 'rgba(244, 63, 94, 0.04)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${formIsEmergency ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined"
                style={{ color: formIsEmergency ? '#f43f5e' : '#859490', fontSize: '24px' }}
              >
                emergency
              </span>
              <div>
                <p className="text-body-sm font-semibold text-[#dde4e1]">Emergency SOS Contact</p>
                <p className="text-[12px] text-[#859490]">Highlight priority contact on dashboard and emergency hub.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formIsEmergency}
                onChange={(e) => setFormIsEmergency(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#bbcac6] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f43f5e] peer-checked:after:bg-white peer-checked:after:border-none"></div>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowFormModal(false)}
              className="flex-1 py-3 rounded-xl text-[#bbcac6] bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl text-white font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                boxShadow: '0 4px 20px rgba(20, 184, 166, 0.2)',
              }}
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                'Save Contact'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirmation Dialog */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Contact"
        description="Are you sure you want to remove this contact? This will permanently delete the record."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}

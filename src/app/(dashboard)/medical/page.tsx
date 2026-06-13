'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { formatDate, getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { FamilyMember, MedicalRecord, Document } from '@/types';
import {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
} from './actions';

const RECORD_TYPES = [
  { id: 'all', label: 'All Records', icon: 'medical_services', color: '#ffb59e' },
  { id: 'report', label: 'Lab Reports', icon: 'biotech', color: '#4fdbc8' },
  { id: 'prescription', label: 'Prescriptions', icon: 'description', color: '#adc6ff' },
  { id: 'scan', label: 'Scans & X-Rays', icon: 'settings_overscan', color: '#a78bfa' },
  { id: 'vaccination', label: 'Vaccinations', icon: 'vaccines', color: '#22c55e' },
  { id: 'appointment', label: 'Appointments', icon: 'event', color: '#f43f5e' },
  { id: 'other', label: 'Others', icon: 'more_horiz', color: '#859490' },
];

export default function MedicalPage() {
  const { user } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [medicalDocs, setMedicalDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('report');
  const [formMemberId, setFormMemberId] = useState('');
  const [formDoctor, setFormDoctor] = useState('');
  const [formHospital, setFormHospital] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // View Details Modal State
  const [viewedRecord, setViewedRecord] = useState<MedicalRecord | null>(null);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch family members
      const { data: membersData } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('full_name');
      setMembers(membersData || []);

      // Fetch medical records
      const items = await fetchMedicalRecords();
      setRecords(items);

      // Fetch Vault documents of category 'medical'
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', user.family_id)
        .eq('category', 'medical')
        .is('deleted_at', null)
        .order('name');
      setMedicalDocs(docs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formMemberId) {
      toast.error('Title and Family Member are required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          member_id: formMemberId,
          type: formType,
          title: formTitle,
          doctor: formDoctor || undefined,
          hospital: formHospital || undefined,
          date: formDate || undefined,
          file_url: formFileUrl || undefined,
          notes: formNotes || undefined,
        };

        if (editingRecordId) {
          await updateMedicalRecord(editingRecordId, payload);
          toast.success('Medical record updated successfully');
        } else {
          await createMedicalRecord(payload);
          toast.success('Medical record added to timeline');
        }

        setShowFormModal(false);
        resetForm();
        const items = await fetchMedicalRecords();
        setRecords(items);
      } catch (err: any) {
        toast.error(err.message || 'Failed to save medical record');
      }
    });
  };

  const resetForm = () => {
    setEditingRecordId(null);
    setFormTitle('');
    setFormType('report');
    setFormMemberId(members[0]?.id || '');
    setFormDoctor('');
    setFormHospital('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormFileUrl('');
    setFormNotes('');
  };

  const handleOpenEdit = (record: MedicalRecord) => {
    setEditingRecordId(record.id);
    setFormTitle(record.title);
    setFormType(record.type);
    setFormMemberId(record.member_id);
    setFormDoctor(record.doctor || '');
    setFormHospital(record.hospital || '');
    setFormDate(record.date || '');
    setFormFileUrl(record.file_url || '');
    setFormNotes(record.notes || '');
    setShowFormModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteMedicalRecord(deleteId);
      toast.success('Medical record removed');
      setDeleteId(null);
      setViewedRecord(null);
      const items = await fetchMedicalRecords();
      setRecords(items);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Filters logic
  const filteredRecords = records.filter((rec) => {
    const matchesType = selectedType === 'all' || rec.type === selectedType;
    const matchesMember = selectedMemberFilter === 'all' || rec.member_id === selectedMemberFilter;
    const matchesSearch =
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.doctor && rec.doctor.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.hospital && rec.hospital.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rec.notes && rec.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesType && matchesMember && matchesSearch;
  });

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-[#ffb59e] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              medical_services
            </span>
            <h1 className="text-headline-md font-bold text-[#dde4e1] tracking-tight">Medical Center</h1>
          </div>
          <p className="text-body-sm text-[#859490]">Family medical timeline, prescriptions, and health reports</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            if (members.length > 0) setFormMemberId(members[0].id);
            setShowFormModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-label-sm font-semibold transition-all bg-[#ffb59e] text-[#5e1800] hover:bg-[#ffb59e]/90 shadow-[0_4px_12px_rgba(255,181,158,0.2)]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Medical Record</span>
        </button>
      </div>

      {/* Grid Layout: Left categories/member filter, Right timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Filters Panel */}
        <div className="space-y-6 lg:col-span-1">
          {/* Member Filter */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
            <label className="text-label-sm text-[#859490] font-semibold uppercase tracking-wider text-[10px] block">
              Filter by Member
            </label>
            <select
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#090f0e] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
            >
              <option value="all">All Family Members</option>
              {members.map((mem) => (
                <option key={mem.id} value={mem.id}>
                  {mem.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Record Type Filters */}
          <div className="space-y-1.5">
            <div className="hidden lg:block pb-2 px-2 text-label-sm text-[#859490] font-semibold uppercase tracking-wider text-[10px]">
              Record Type
            </div>
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-1.5 scrollbar-none">
              {RECORD_TYPES.map((type) => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-label-sm font-medium transition-all shrink-0 lg:shrink ${
                      isSelected
                        ? 'bg-[#ffb59e]/10 text-[#ffb59e] border border-[#ffb59e]/20'
                        : 'bg-white/3 lg:bg-transparent text-[#bbcac6] hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: type.color }}>
                      {type.icon}
                    </span>
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Timeline Panel */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#859490] text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by diagnosis, doctor, clinic, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/8 bg-white/3 text-body-sm text-white focus:outline-none focus:border-[#ffb59e] transition-all"
            />
          </div>

          {/* Timeline View */}
          {loading && records.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined animate-spin text-[32px] text-[#ffb59e]">progress_activity</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-white/5">
              <span className="material-symbols-outlined text-[48px] text-[#859490] mb-3">clinical_notes</span>
              <h3 className="text-body-lg font-semibold text-[#dde4e1]">No Health Records Found</h3>
              <p className="text-body-sm text-[#859490] mt-1 max-w-sm mx-auto">
                No medical center items match your search. Add records to build your family health history.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-white/5 pl-6 ml-4 space-y-6 py-2">
              {filteredRecords.map((record) => {
                const member = members.find((m) => m.id === record.member_id);
                const typeInfo = RECORD_TYPES.find((t) => t.id === record.type);
                
                return (
                  <div
                    key={record.id}
                    className="relative group transition-all"
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border border-[#090f0e] flex items-center justify-center shrink-0 z-10 transition-all group-hover:scale-110"
                      style={{
                        background: typeInfo?.color || '#ffb59e',
                        boxShadow: `0 0 10px ${typeInfo?.color || '#ffb59e'}40`,
                      }}
                    >
                      <span className="material-symbols-outlined text-[10px] text-black font-bold">
                        {typeInfo?.icon === 'more_horiz' ? 'circle' : typeInfo?.icon}
                      </span>
                    </div>

                    {/* Card container */}
                    <div
                      onClick={() => setViewedRecord(record)}
                      className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row justify-between items-start gap-4 hover:border-white/12 transition-all cursor-pointer"
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#ffb59e] px-2 py-0.5 rounded bg-[#ffb59e]/10 border border-[#ffb59e]/20">
                            {typeInfo?.label || 'Record'}
                          </span>
                          <span className="text-label-sm text-[#859490] font-mono">
                            {record.date ? formatDate(record.date) : 'N/A'}
                          </span>
                        </div>

                        <h3 className="text-body-md font-semibold text-[#dde4e1] truncate group-hover:text-[#ffb59e] transition-colors">
                          {record.title}
                        </h3>

                        {/* Doctor/Hospital subtitle */}
                        {(record.doctor || record.hospital) && (
                          <p className="text-body-sm text-[#859490] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">medical_information</span>
                            <span>
                              {record.doctor && `Dr. ${record.doctor}`}
                              {record.doctor && record.hospital && ' • '}
                              {record.hospital && record.hospital}
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Right panel: Member assignee and quick actions */}
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-3 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                        {member && (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-white/10"
                              style={{ background: getAvatarStyle(member.full_name) }}
                            >
                              {getInitials(member.full_name)}
                            </div>
                            <span className="text-label-sm text-[#bbcac6] truncate max-w-[100px]">
                              {member.full_name.split(' ')[0]}
                            </span>
                          </div>
                        )}

                        {record.file_url && (
                          <span className="material-symbols-outlined text-[#4fdbc8] text-[18px] sm:mt-1.5" title="Vault Document Attached">
                            attachment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* 4. NexusModal - Setup/Edit Form */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingRecordId ? 'Edit Medical Record' : 'Add Medical Record'}
        description="Fill out the fields to add a medical event, prescription, or report."
        size="md"
      >
        <form onSubmit={handleSaveRecord} className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Title / Diagnosis</label>
              <input
                type="text"
                required
                placeholder="e.g. Annual Blood Checkup"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Record Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              >
                {RECORD_TYPES.filter(t => t.id !== 'all').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Family Member</label>
              <select
                value={formMemberId}
                onChange={(e) => setFormMemberId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              >
                {members.map((mem) => (
                  <option key={mem.id} value={mem.id}>
                    {mem.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Record Date</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Doctor Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Dr. K. Sharma"
                value={formDoctor}
                onChange={(e) => setFormDoctor(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm text-[#bbcac6]">Hospital / Clinic (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Max Hospital"
                value={formHospital}
                onChange={(e) => setFormHospital(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
              />
            </div>
          </div>

          {/* Document Vault Attachment Selection */}
          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Vault Document Attachment (Optional)</label>
            <select
              value={formFileUrl}
              onChange={(e) => setFormFileUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e]"
            >
              <option value="">No document attached</option>
              {medicalDocs.map((doc) => (
                <option key={doc.id} value={doc.file_url}>
                  {doc.name} (Vault)
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#859490]">
              Central documents uploaded under &ldquo;Medical&rdquo; tab in Vault can be attached here.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-label-sm text-[#bbcac6]">Health Notes / Prescriptions Details</label>
            <textarea
              rows={3}
              placeholder="e.g. Dosage instructions, test results, next appointment date..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/8 bg-[#0e1513] text-body-sm text-white focus:outline-none focus:border-[#ffb59e] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="flex-1 py-3 rounded-xl font-semibold border border-white/8 text-[#bbcac6] bg-white/3 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl font-semibold bg-[#ffb59e] text-[#5e1800] hover:bg-[#ffb59e]/90 transition-all flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                'Save Record'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* 5. NexusModal - Detailed View Panel */}
      <NexusModal
        isOpen={viewedRecord !== null}
        onClose={() => setViewedRecord(null)}
        title={viewedRecord?.title || 'Record Details'}
        description="Detailed overview of the medical history record."
        size="md"
      >
        {viewedRecord && (
          <div className="space-y-5 py-1 text-body-sm">
            
            {/* Split Info grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/3 border border-white/5 text-[#bbcac6]">
              <div>
                <span className="text-[10px] text-[#859490] block mb-0.5">Date</span>
                <span className="font-semibold text-white">{viewedRecord.date ? formatDate(viewedRecord.date) : 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#859490] block mb-0.5">Category</span>
                <span className="font-semibold text-white capitalize">{viewedRecord.type}</span>
              </div>
              {viewedRecord.doctor && (
                <div>
                  <span className="text-[10px] text-[#859490] block mb-0.5">Doctor</span>
                  <span className="font-semibold text-white">Dr. {viewedRecord.doctor}</span>
                </div>
              )}
              {viewedRecord.hospital && (
                <div>
                  <span className="text-[10px] text-[#859490] block mb-0.5">Hospital / Clinic</span>
                  <span className="font-semibold text-white">{viewedRecord.hospital}</span>
                </div>
              )}
            </div>

            {/* Document attachment if exists */}
            {viewedRecord.file_url && (
              <div className="p-3.5 rounded-xl bg-[#4fdbc8]/5 border border-[#4fdbc8]/15 flex items-center justify-between text-body-sm">
                <div>
                  <span className="text-[10px] text-[#859490] block">Attached Vault File</span>
                  <span className="font-semibold text-white">Medical Document</span>
                </div>
                <a
                  href={viewedRecord.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-label-sm font-semibold bg-[#4fdbc8] text-[#003731] hover:bg-[#4fdbc8]/90 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  View File
                </a>
              </div>
            )}

            {/* Notes content */}
            {viewedRecord.notes && (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-[#859490] tracking-wider block">Health Notes / Treatment Details</span>
                <p className="text-body-sm text-[#bbcac6] whitespace-pre-line bg-black/20 p-4 rounded-xl leading-relaxed border border-white/3">
                  {viewedRecord.notes}
                </p>
              </div>
            )}

            {/* Actions Footer */}
            <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
              <button
                onClick={() => setDeleteId(viewedRecord.id)}
                className="px-4 py-2.5 rounded-xl font-medium transition-all text-label-sm bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40"
              >
                Delete Record
              </button>
              <button
                onClick={() => handleOpenEdit(viewedRecord)}
                className="px-4 py-2.5 rounded-xl font-semibold bg-white/5 border border-white/8 text-[#bbcac6] hover:bg-white/10 hover:text-white transition-all text-label-sm"
              >
                Edit Details
              </button>
              <button
                onClick={() => setViewedRecord(null)}
                className="px-6 py-2.5 rounded-xl font-semibold bg-white/5 border border-white/8 text-white hover:bg-white/10 transition-all text-label-sm"
              >
                Close
              </button>
            </div>

          </div>
        )}
      </NexusModal>

      {/* 6. NexusConfirm - Delete record */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Medical Record?"
        description="This will permanently delete this record from your family medical timeline. This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />

    </div>
  );
}

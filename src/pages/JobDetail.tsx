import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Calendar,
  Laptop,
  Building2,
  Star,
  Phone,
  Lock,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  FileText,
  ExternalLink,
  ShieldAlert,
  Award,
  Edit3,
  ArrowLeft,
  Info,
  RefreshCw,
  Trash2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useToast } from '../components/Toast';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { JobsRlsFixBanner } from '../components/JobsRlsFixBanner';
import { isJobsRlsError } from '../lib/jobsSqlFix';
import { toEnglishDigits, translateSupabaseError, syncAuthenticatedUserProfile } from '../lib/supabase';
import {
  fetchJobById,
  fetchMutualJobContacts,
  fetchJobApplications,
  submitJobApplication,
  withdrawJobApplication,
  acceptJobApplication,
  rejectJobApplication,
  markJobDelivered,
  markJobCompleted,
  updateOwnJobStatus,
  deleteOwnJob,
  fetchJobMessages,
  sendJobMessage,
  fetchReviewsForJob,
  submitJobReview,
} from '../lib/marketplaceService';
import type { Job, JobApplication, JobMessage, Review } from '../types/database';

const JOB_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_approval: {
    label: 'অ্যাডমিন অনুমোদনের অপেক্ষায়',
    cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  open: {
    label: 'আবেদন চলছে (Open)',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  in_progress: {
    label: 'কাজ চলমান (In Progress)',
    cls: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  delivered: {
    label: 'কাজ জমা দেওয়া হয়েছে (Delivered)',
    cls: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  },
  completed: {
    label: 'সফলভাবে সম্পন্ন (Completed)',
    cls: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
  },
  rejected: {
    label: 'প্রত্যাখ্যাত (Rejected)',
    cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  },
  cancelled: {
    label: 'বাতিল (Cancelled)',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  closed: {
    label: 'বন্ধ (Closed)',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

const APP_STATUS_LABELS: Record<string, string> = {
  pending: 'বিবেচনাধীন',
  accepted: 'গৃহীত ও নির্বাচিত',
  rejected: 'প্রত্যাখ্যাত',
  withdrawn: 'প্রত্যাহারকৃত',
};

export const JobDetail: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const isAuthenticated = Boolean(user || profile);
  const { settings } = useSiteSettings();
  const { showToast } = useToast();

  const myActorIds = Array.from(new Set([profile?.id, user?.id].filter(Boolean))) as string[];
  const myActorId = profile?.id || user?.id || '';
  const isVerified = Boolean(profile?.is_verified) || profile?.verification_status === 'verified';

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [rlsError, setRlsError] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [myApplication, setMyApplication] = useState<JobApplication | null>(null);
  const [contacts, setContacts] = useState<{ posterPhone: string | null; workerPhone: string | null }>({
    posterPhone: null,
    workerPhone: null,
  });

  // Proposal form
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('3');
  const [submittingApp, setSubmittingApp] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Messaging
  const [threadParticipants, setThreadParticipants] = useState<{ id: string; name: string }[]>([]);
  const [selectedApplicantThread, setSelectedApplicantThread] = useState<string>('');
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadAll = async () => {
    if (!jobId) return;
    setLoading(true);
    setRlsError(false);
    try {
      const loadedJob = await fetchJobById(jobId, { throwOnRlsError: true });
      setJob(loadedJob);
      if (!loadedJob) {
        setLoading(false);
        return;
      }

      const actorSet = new Set([profile?.id, user?.id].filter(Boolean) as string[]);
      const ownerMatch = actorSet.has(loadedJob.poster_id);
      const workerMatch = Boolean(loadedJob.assigned_to && actorSet.has(loadedJob.assigned_to));

      // Load applications & message threads
      if (isAuthenticated && myActorId) {
        const appList = await fetchJobApplications(
          loadedJob.id,
          ownerMatch && !isAdmin ? settings.require_application_approval : false
        );

        if (ownerMatch || isAdmin) {
          setApplications(appList);

          // Also discover pre-application message senders so owner can view & reply
          const allJobMsgs = await fetchJobMessages(loadedJob.id);
          const participantMap = new Map<string, string>();
          appList.forEach((a) => {
            participantMap.set(
              a.applicant_id,
              a.applicant?.full_name || 'আবেদনকারী পেশাজীবী'
            );
          });
          allJobMsgs.forEach((m) => {
            if (m.applicant_id && m.applicant_id !== loadedJob.poster_id) {
              if (!participantMap.has(m.applicant_id)) {
                const senderName =
                  m.sender_id === m.applicant_id
                    ? m.sender?.full_name || 'আগ্রহী পেশাজীবী'
                    : 'আগ্রহী পেশাজীবী';
                participantMap.set(m.applicant_id, senderName);
              }
            }
          });

          const participants = Array.from(participantMap.entries()).map(([id, name]) => ({
            id,
            name,
          }));
          setThreadParticipants(participants);

          if (participants.length > 0) {
            setSelectedApplicantThread((prev) => {
              if (prev && participantMap.has(prev)) return prev;
              if (loadedJob.assigned_to && participantMap.has(loadedJob.assigned_to)) {
                return loadedJob.assigned_to;
              }
              return participants[0].id;
            });
          }
        }

        const mine = appList.find((a) => actorSet.has(a.applicant_id)) || null;
        setMyApplication(mine);
        if (!ownerMatch) {
          setSelectedApplicantThread(mine?.applicant_id || myActorId);
        }
      }

      // Reveal mutual contacts strictly after an applicant is accepted
      if (loadedJob.assigned_to && (ownerMatch || workerMatch || isAdmin)) {
        const viewerActor = ownerMatch
          ? loadedJob.poster_id
          : workerMatch
          ? loadedJob.assigned_to
          : myActorId;
        const revealed = await fetchMutualJobContacts(loadedJob, viewerActor, isAdmin);
        setContacts(revealed);
      } else {
        setContacts({ posterPhone: null, workerPhone: null });
      }

      // Reviews
      const revList = await fetchReviewsForJob(loadedJob.id);
      setReviews(revList);
    } catch (err) {
      console.error('[JobDetail] loadAll error:', err);
      if (isJobsRlsError(err)) {
        setRlsError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [jobId, myActorId, isAdmin]);

  const isOwner = Boolean(job && myActorIds.includes(job.poster_id));
  const isAssignedWorker = Boolean(job && job.assigned_to && myActorIds.includes(job.assigned_to));

  // Load thread messages when thread changes
  const activeThreadApplicantId = isOwner || isAdmin ? selectedApplicantThread : myActorId;

  const loadMessages = async () => {
    if (!job || !activeThreadApplicantId) {
      setMessages([]);
      return;
    }
    const list = await fetchJobMessages(job.id, activeThreadApplicantId);
    setMessages(list);
  };

  useEffect(() => {
    if (!job || !isAuthenticated || !activeThreadApplicantId) return;
    loadMessages();
  }, [job?.id, activeThreadApplicantId, isAuthenticated]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || (!profile && !user)) {
      showToast('আবেদন করার পূর্বে অনুগ্রহ করে লগইন করুন।', 'error');
      return;
    }

    const priceNum = Number(toEnglishDigits(proposedPrice.trim()));
    const daysNum = Number(toEnglishDigits(estimatedDays.trim()));

    if (!coverLetter.trim() || coverLetter.trim().length < 10) {
      showToast('কভার লেটারে কমপক্ষে ১০ অক্ষরে আপনার প্রস্তাব লিখুন।', 'error');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      showToast('সঠিক প্রস্তাবিত মূল্য (৳) উল্লেখ করুন।', 'error');
      return;
    }
    if (!Number.isFinite(daysNum) || daysNum < 1) {
      showToast('আনুমানিক কত দিনে কাজ শেষ করবেন তা উল্লেখ করুন।', 'error');
      return;
    }

    setSubmittingApp(true);
    try {
      const applicantProf =
        profile || (user ? await syncAuthenticatedUserProfile(user) : null);
      if (!applicantProf) {
        showToast('প্রোফাইল তথ্য লোড করা যায়নি। পুনরায় চেষ্টা করুন।', 'error');
        return;
      }

      const created = await submitJobApplication({
        job,
        applicantProfile: applicantProf,
        cover_letter: coverLetter.trim(),
        proposed_price: priceNum,
        estimated_days: daysNum,
        settings,
      });
      setMyApplication(created);
      setSelectedApplicantThread(applicantProf.id);
      setCoverLetter('');
      showToast('আপনার প্রস্তাব সফলভাবে জমা দেওয়া হয়েছে!', 'success');
    } catch (err: any) {
      console.error('[JobDetail] handleApply error:', err);
      if (isJobsRlsError(err)) {
        setRlsError(true);
      }
      showToast(translateSupabaseError(err, 'আবেদন জমা দিতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    setActionBusy(true);
    try {
      await withdrawJobApplication(myApplication.id);
      showToast('আপনার আবেদন প্রত্যাহার করা হয়েছে।', 'info');
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আবেদন প্রত্যাহার করা যায়নি।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleCloseJob = async () => {
    if (!job) return;
    const nextStatus = job.status === 'open' ? 'closed' : 'open';
    setActionBusy(true);
    try {
      await updateOwnJobStatus(job.id, nextStatus);
      showToast(
        nextStatus === 'closed'
          ? 'জবটি সাময়িকভাবে বন্ধ করা হয়েছে।'
          : 'জবটি পুনরায় আবেদন গ্রহণের জন্য চালু করা হয়েছে!',
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জবের স্ট্যাটাস পরিবর্তন করা যায়নি।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteOwnJob = async () => {
    if (!job) return;
    setActionBusy(true);
    try {
      await deleteOwnJob(job.id);
      showToast('জব পোস্টটি সফলভাবে মুছে ফেলা হয়েছে।', 'success');
      navigate('/my-jobs');
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব মুছে ফেলতে সমস্যা হয়েছে।'), 'error');
      setConfirmDelete(false);
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcceptApplicant = async (app: JobApplication) => {
    if (!job) return;
    setActionBusy(true);
    try {
      await acceptJobApplication(job, app);
      showToast(
        'আবেদনকারীকে নির্বাচিত করা হয়েছে! উভয় পক্ষের ফোন নম্বর এখন উন্মুক্ত করা হয়েছে।',
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আবেদন গ্রহণ করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectApplicant = async (app: JobApplication) => {
    if (!job) return;
    setActionBusy(true);
    try {
      await rejectJobApplication(job, app);
      showToast('আবেদনটি প্রত্যাখ্যান করা হয়েছে।', 'info');
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'আবেদন প্রত্যাখ্যান করা যায়নি।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!job) return;
    setActionBusy(true);
    try {
      await markJobDelivered(job);
      showToast('কাজ জমা দেওয়া হয়েছে! ক্লায়েন্ট যাচাই করে সম্পন্ন নিশ্চিত করবেন।', 'success');
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'কাজ জমা দিতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!job) return;
    setActionBusy(true);
    try {
      await markJobCompleted(job);
      showToast('অভিনন্দন! জবটি সম্পন্ন হিসেবে চিহ্নিত হয়েছে। এখন রেটিং ও রিভিউ দিন।', 'success');
      await loadAll();
      await refreshProfile();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'জব সম্পন্ন করতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !myActorId || !activeThreadApplicantId || !messageInput.trim()) return;

    const receiverId = isOwner ? activeThreadApplicantId : job.poster_id;

    setSendingMsg(true);
    try {
      await sendJobMessage({
        job,
        applicant_id: activeThreadApplicantId,
        sender_id: myActorId,
        sender_name: profile?.full_name || user?.email || 'ব্যবহারকারী',
        receiver_id: receiverId,
        content: messageInput.trim(),
      });
      setMessageInput('');
      await loadMessages();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'মেসেজ পাঠাতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !myActorId || !job.assigned_to) return;

    const revieweeId = isOwner ? job.assigned_to : job.poster_id;
    setSubmittingReview(true);
    try {
      await submitJobReview({
        job,
        reviewer_id: myActorId,
        reviewee_id: revieweeId,
        rating,
        comment: reviewComment.trim(),
      });
      setReviewComment('');
      showToast('আপনার রেটিং ও রিভিউ সফলভাবে যুক্ত হয়েছে!', 'success');
      await loadAll();
    } catch (err: any) {
      showToast(translateSupabaseError(err, 'রিভিউ জমা দিতে সমস্যা হয়েছে।'), 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        {rlsError && <JobsRlsFixBanner onRetry={loadAll} />}
        <div className="max-w-xl mx-auto text-center space-y-4 py-6">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            জবটি খুঁজে পাওয়া যায়নি অথবা অনুমোদনের অপেক্ষায় রয়েছে
          </h2>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>জব তালিকায় ফিরে যান</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusMeta = JOB_STATUS_LABELS[job.status] || JOB_STATUS_LABELS.open;
  const locText = [job.upazila_name, job.district_name, job.division_name]
    .filter(Boolean)
    .join(', ');

  const formatBudget = () => {
    if (job.budget_min && job.budget_max && job.budget_min !== job.budget_max) {
      return `৳${job.budget_min.toLocaleString('bn-BD')} - ৳${job.budget_max.toLocaleString('bn-BD')}`;
    }
    const val = job.budget_max ?? job.budget_min;
    return val ? `৳${val.toLocaleString('bn-BD')}` : 'আলোচনা সাপেক্ষে';
  };

  const myAlreadyReviewed = reviews.some((r) => myActorIds.includes(r.reviewer_id));
  const canLeaveReview =
    job.status === 'completed' &&
    Boolean(job.assigned_to) &&
    (isOwner || isAssignedWorker) &&
    !myAlreadyReviewed;

  const canMessage =
    isAuthenticated &&
    Boolean(myActorId) &&
    (((isOwner || isAdmin) && threadParticipants.length > 0) ||
      isAssignedWorker ||
      (!isOwner && (Boolean(myApplication) || job.status === 'open')));

  const canDeleteJob =
    (isOwner || isAdmin) && job.status !== 'in_progress' && job.status !== 'delivered';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {rlsError && <JobsRlsFixBanner onRetry={loadAll} />}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[var(--brand-primary)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>সকল জব দেখুন</span>
        </Link>

        {(isOwner || isAdmin) && (
          <div className="flex items-center gap-2 flex-wrap">
            {job.status === 'open' && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleToggleCloseJob}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>জব বন্ধ করুন</span>
              </button>
            )}

            {(job.status === 'closed' || job.status === 'cancelled') && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleToggleCloseJob}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>পুনরায় চালু করুন</span>
              </button>
            )}

            <Link
              to={`/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-[var(--brand-primary)] transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              <span>জব এডিট করুন</span>
            </Link>

            {canDeleteJob && (
              confirmDelete ? (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                    নিশ্চিত মুছবেন?
                  </span>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleDeleteOwnJob}
                    className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    হ্যাঁ
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg cursor-pointer"
                  >
                    না
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মুছে ফেলুন</span>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Admin rejection note if rejected */}
      {job.status === 'rejected' && job.admin_note && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs sm:text-sm text-rose-800 dark:text-rose-200 font-semibold">
          <strong>অ্যাডমিনের নোট:</strong> {job.admin_note}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT 2 COLS: Job Content, Workflow Actions, Proposals, Messaging, Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Main Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[var(--brand-primary)] uppercase tracking-wider">
                {job.category}
              </span>
              <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-siliguri leading-snug">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                {job.work_mode === 'remote' ? (
                  <>
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    <span>রিমোট / অনলাইন</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-[var(--brand-primary)]" />
                    <span>সরাসরি সাইটে (Onsite)</span>
                  </>
                )}
              </span>

              {locText && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>{locText}</span>
                </span>
              )}

              {job.deadline && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>ডেডলাইন: {new Date(job.deadline).toLocaleDateString('bn-BD')}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>পোস্ট: {new Date(job.created_at).toLocaleDateString('bn-BD')}</span>
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">কাজের বিস্তারিত বিবরণ</h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            {/* Attachments */}
            {job.attachments && job.attachments.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">সংযুক্ত ডকুমেন্ট / ছবি</h4>
                <div className="flex flex-wrap gap-2.5">
                  {job.attachments.map((url, idx) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-[var(--brand-primary)] transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>সংযুক্ত ফাইল #{idx + 1}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DELIVERY & COMPLETION WORKFLOW BANNER (For Hired Worker & Job Owner) */}
          {job.assigned_to && (isOwner || isAssignedWorker || isAdmin) && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-blue-200 dark:border-blue-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[var(--brand-primary)] uppercase">
                    চলমান কাজের অগ্রগতি ও যোগাযোগ
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    নির্বাচিত পেশাজীবী:{' '}
                    {job.assignee ? (
                      <Link
                        to={`/profile/${job.assignee.id}`}
                        className="text-[var(--brand-primary)] hover:underline inline-flex items-center gap-1"
                      >
                        <span>{job.assignee.full_name}</span>
                        {job.assignee.is_verified && <VerifiedBadge size="sm" />}
                      </Link>
                    ) : (
                      'নির্বাচিত কর্মী'
                    )}
                  </h3>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2.5">
                  {isAssignedWorker && job.status === 'in_progress' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleMarkDelivered}
                      className="px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      ✓ কাজ সম্পন্ন করে জমা দিন (Delivered)
                    </button>
                  )}

                  {isOwner && (job.status === 'in_progress' || job.status === 'delivered') && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleMarkCompleted}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      ✓ কাজ বুঝে পেয়েছি — সম্পন্ন করুন (Complete)
                    </button>
                  )}
                </div>
              </div>

              {/* Mutual Contact Reveal Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      জব দাতার ফোন নম্বর
                    </div>
                    <div className="text-sm font-mono font-black text-slate-900 dark:text-white">
                      {contacts.posterPhone || 'নম্বর সংযুক্ত নেই'}
                    </div>
                  </div>
                  {contacts.posterPhone && (
                    <a
                      href={`tel:${contacts.posterPhone}`}
                      className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>কল</span>
                    </a>
                  )}
                </div>

                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                      নির্বাচিত পেশাজীবীর ফোন নম্বর
                    </div>
                    <div className="text-sm font-mono font-black text-slate-900 dark:text-white">
                      {contacts.workerPhone || 'নম্বর সংযুক্ত নেই'}
                    </div>
                  </div>
                  {contacts.workerPhone && (
                    <a
                      href={`tel:${contacts.workerPhone}`}
                      className="px-3 py-2 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>কল</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1–5 STAR REVIEW FORM (After Completion) */}
          {canLeaveReview && (
            <form
              onSubmit={handleReviewSubmit}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-amber-200 dark:border-amber-800 shadow-sm space-y-4"
            >
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>কাজের অভিজ্ঞতা মূল্যায়ন ও রেটিং দিন (১–৫ স্টার)</span>
              </h3>

              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-amber-600 ml-2">{rating} / 5 স্টার</span>
              </div>

              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="কাজের মান, সময়ানুবর্তিতা ও যোগাযোগ সম্পর্কে আপনার মতামত লিখুন..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />

              <button
                type="submit"
                disabled={submittingReview}
                className="px-6 py-2.5 bg-brand text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'জমা হচ্ছে...' : 'রিভিউ জমা দিন'}
              </button>
            </form>
          )}

          {/* Submitted Reviews for this Job */}
          {reviews.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                এই জবের রেটিং ও রিভিউ ({reviews.length})
              </h3>
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        <span>{rev.reviewer?.full_name || 'ব্যবহারকারী'}</span>
                        {rev.reviewer?.is_verified && <VerifiedBadge size="sm" />}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROPOSAL / APPLICATION SECTION (For Non-Owner Users) */}
          {!isOwner && job.status === 'open' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                এই জবে আপনার প্রস্তাব (Proposal) পাঠান
              </h3>

              {!isAuthenticated ? (
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-center space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-semibold">
                    জবে আবেদন করতে অনুগ্রহ করে লগইন করুন।
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl"
                  >
                    লগইন করুন
                  </Link>
                </div>
              ) : myApplication && myApplication.status !== 'withdrawn' ? (
                <div className="p-5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-[var(--brand-primary)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>আপনি এই জবে ইতিমধ্যে আবেদন করেছেন</span>
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700">
                      স্ট্যাটাস: {APP_STATUS_LABELS[myApplication.status] || myApplication.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    প্রস্তাবিত বাজেট: <strong>৳{myApplication.proposed_price}</strong> • সময়:{' '}
                    <strong>{myApplication.estimated_days} দিন</strong>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {myApplication.cover_letter}
                  </p>
                  {myApplication.status === 'pending' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleWithdraw}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      আবেদন প্রত্যাহার করুন
                    </button>
                  )}
                </div>
              ) : settings.require_verified_to_apply_job && !isVerified && !isAdmin ? (
                <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                        জবে আবেদন করতে ভেরিফাইড প্রোফাইল আবশ্যিক
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300/90">
                        অনুগ্রহ করে প্রথমে আপনার প্রোফাইল ভেরিফাই করুন, তারপর যেকোনো জবে প্রস্তাব পাঠাতে পারবেন।
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/verify"
                    className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl shrink-0"
                  >
                    ভেরিফাই করুন →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleApply} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        আপনার প্রস্তাবিত পারিশ্রমিক (৳ টাকা) *
                      </label>
                      <input
                        type="text"
                        value={proposedPrice}
                        onChange={(e) => setProposedPrice(e.target.value)}
                        required
                        placeholder="যেমন: 4000"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        আনুমানিক সময় (কত দিনে সম্পন্ন করবেন) *
                      </label>
                      <input
                        type="text"
                        value={estimatedDays}
                        onChange={(e) => setEstimatedDays(e.target.value)}
                        required
                        placeholder="যেমন: 3"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      কভার লেটার / কাজের প্রস্তাবনা *
                    </label>
                    <textarea
                      rows={4}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      required
                      placeholder="আপনি কীভাবে কাজটি সম্পন্ন করবেন এবং আপনার পূর্ব অভিজ্ঞতা সংক্ষেপে লিখুন..."
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingApp}
                    className="w-full sm:w-auto px-6 py-3 bg-brand text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submittingApp ? 'প্রস্তাব পাঠানো হচ্ছে...' : 'প্রস্তাব জমা দিন'}</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* APPLICANTS LIST (Visible to Job Owner & Admin) */}
          {(isOwner || isAdmin) && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  আবেদনকারীদের তালিকা ({applications.length})
                </h3>
              </div>

              {applications.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                  এখনো কোনো প্রস্তাব জমা পড়েনি।
                </p>
              ) : (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className={`p-5 rounded-2xl border space-y-3 ${
                        app.status === 'accepted'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/profile/${app.applicant_id}`}
                              className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white hover:text-[var(--brand-primary)]"
                            >
                              {app.applicant?.full_name || 'আবেদনকারী পেশাজীবী'}
                            </Link>
                            {app.applicant?.is_verified && <VerifiedBadge size="sm" showLabel />}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span>{app.applicant?.profession_name || 'পেশাজীবী'}</span>
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>
                                {app.applicant?.review_count
                                  ? `${Number(app.applicant.avg_rating).toFixed(1)} (${app.applicant.review_count})`
                                  : 'নতুন'}
                              </span>
                            </span>
                            <span>
                              সম্পন্ন কাজ: <strong>{app.applicant?.completed_jobs_count || 0}টি</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <div className="text-base font-black text-[var(--brand-primary)]">
                            ৳{app.proposed_price.toLocaleString('bn-BD')}
                          </div>
                          <div className="text-xs text-slate-500">
                            আনুমানিক {app.estimated_days} দিন
                          </div>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        {app.cover_letter}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedApplicantThread(app.applicant_id)}
                          className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer hover:border-[var(--brand-primary)]"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          <span>মেসেজ করুন</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {job.status === 'open' && app.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleAcceptApplicant(app)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                              >
                                ✓ গ্রহণ ও হায়ার করুন
                              </button>
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleRejectApplicant(app)}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                              >
                                প্রত্যাখ্যান
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              স্ট্যাটাস: {APP_STATUS_LABELS[app.status] || app.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* IN-JOB MESSAGING THREAD */}
          {canMessage && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[var(--brand-primary)]" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    জব মেসেজিং (সরাসরি কথোপকথন)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {(isOwner || isAdmin) && threadParticipants.length > 0 && (
                    <select
                      value={selectedApplicantThread}
                      onChange={(e) => setSelectedApplicantThread(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      {threadParticipants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={loadMessages}
                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 cursor-pointer"
                    title="মেসেজ রিফ্রেশ করুন"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2.5 p-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    এখনো কোনো মেসেজ আদান-প্রদান হয়নি। নিচে মেসেজ লিখে কথা শুরু করুন।
                  </p>
                ) : (
                  messages.map((m) => {
                    const isMine = myActorIds.includes(m.sender_id);
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm ${
                            isMine
                              ? 'bg-brand text-white rounded-br-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                          {new Date(m.created_at).toLocaleTimeString('bn-BD', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="আপনার মেসেজ লিখুন..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !messageInput.trim()}
                  className="px-4 py-2.5 bg-brand text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>পাঠান</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Budget, Poster Info, Contact Privacy & Payment Notice */}
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* Budget Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">প্রস্তাবিত বাজেট</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {formatBudget()}
            </div>
            <div className="text-xs font-bold text-[var(--brand-primary)]">
              {job.budget_type === 'negotiable' ? 'আলোচনা সাপেক্ষে (Negotiable)' : 'নির্ধারিত বাজেট (Fixed Price)'}
            </div>
          </div>

          {/* Poster Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              জব দাতার তথ্য
            </h4>
            {job.poster ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {job.poster.profile_photo_url ? (
                    <img
                      src={job.poster.profile_photo_url}
                      alt={job.poster.full_name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand text-white font-black flex items-center justify-center">
                      {job.poster.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {job.poster.full_name}
                      </span>
                      {job.poster.is_verified && <VerifiedBadge size="sm" />}
                    </div>
                    {job.poster.review_count > 0 && (
                      <div className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>
                          {Number(job.poster.avg_rating).toFixed(1)} ({job.poster.review_count} রিভিউ)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!job.assigned_to && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <Lock className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                    <span>
                      জব দাতা একজন আবেদনকারীকে গ্রহণ (Accept) করার আগ পর্যন্ত উভয় পক্ষের ফোন নম্বর গোপন থাকবে।
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">জব দাতার তথ্য লোড হচ্ছে...</p>
            )}
          </div>

          {/* Payment Outside App Notice */}
          <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-3xl p-5 border border-amber-200 dark:border-amber-800/70 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
              <div className="font-extrabold">পেমেন্ট ও লেনদেন নির্দেশনা</div>
              <p>
                জমি৩৬০ অ্যাপের ভেতরে কোনো অনলাইন পেমেন্ট গ্রহণ করা হয় না। কাজ ও পারিশ্রমিক উভয় পক্ষের পারস্পরিক সমঝোতায় সরাসরি সম্পন্ন করবেন।
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

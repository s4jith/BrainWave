
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import {
  BookOpen, Upload, Trash2, Database, Loader2, Plus, ChevronDown, ChevronRight,
  RefreshCw, CheckCircle, FileText, Layers, Book, GraduationCap, FileQuestion
} from "lucide-react";
import { CardLoader } from "../components/LoadingSpinner";
import { getCombinedClassSubjectOptions, parseCombinedValue, createCombinedValue } from "../constants/academicConstants";
import authFetch from "../utils/authFetch";

import { useToast } from "../contexts/ToastContext";
const API_BASE = import.meta.env.VITE_API_URL;

export default function BookManagement() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [pineconeStats, setPineconeStats] = useState(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState([]); 
  const [loadingCurriculum, setLoadingCurriculum] = useState(true);

  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    title: "",
    classSubject: "6-Maths",  
    chapter_number: 1,
    description: "",
    pdf_file: null
  });

  useEffect(() => {
    fetchHierarchicalStructure();
    fetchPineconeStats();
    fetchCurriculumSubjects();
  }, []);

  const fetchHierarchicalStructure = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/books/admin/hierarchical-structure`);
      if (response.ok) setStructure((await response.json()).structure);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchPineconeStats = async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/books/admin/pinecone-stats`);
      if (response.ok) setPineconeStats((await response.json()).stats);
    } catch (err) { console.error(err); }
  };

  const fetchCurriculumSubjects = async () => {
    setLoadingCurriculum(true);
    try {
      const response = await authFetch(`${API_BASE}/api/curriculum/subjects?is_active=true`);
      if (response.ok) {
        const data = await response.json();
        setCurriculumSubjects(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching curriculum subjects:", error);
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const classSubjectOptions = curriculumSubjects.map(subj => ({
    value: `${subj.class_level}-${subj.subject_name}`,
    label: `Class ${subj.class_level} - ${subj.subject_name}`
  })).sort((a, b) => a.label.localeCompare(b.label));

  const toggleSubject = (subject) => setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }));
  const toggleClass = (subject, classLevel) => setExpandedClasses(prev => ({ ...prev, [`${subject}-${classLevel}`]: !prev[`${subject}-${classLevel}`] }));

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.pdf_file) return toast.info("Please select a PDF file")
    if (!uploadForm.title.trim()) return toast.warning("Please enter a title")

    const { class: classLevel, subject } = parseCombinedValue(uploadForm.classSubject);
    if (!classLevel || !subject) return toast.info("Please select class and subject")

    setUploading(true);
    setUploadProgress({ stage: "uploading", message: "Uploading...", percent: 10 });

    try {
      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('subject', subject);
      formData.append('class_level', classLevel);
      formData.append('chapter_number', uploadForm.chapter_number);
      formData.append('description', uploadForm.description);
      formData.append('pdf_file', uploadForm.pdf_file);
      formData.append("generate_embeddings", "true");

      setUploadProgress({ stage: "processing", message: "Processing...", percent: 30 });

      const response = await authFetch(`${API_BASE}/api/books/upload`, { method: "POST", body: formData });

      if (response.ok) {
        setUploadProgress({ stage: "complete", message: "Done!", percent: 100 });
        toast.success("Chapter uploaded successfully!")
        setShowUploadModal(false);
        setUploadForm({ title: "", classSubject: "6-Maths", chapter_number: 1, description: "", pdf_file: null });
        setUploadProgress(null);
        fetchHierarchicalStructure();
        fetchPineconeStats();
      } else {
        const error = await response.json();
        toast.error(`Upload failed: ${error.detail}`)
      }
    } catch (err) {
      toast.error("Upload failed.")
    } finally { setUploading(false); }
  };

  const formatSubjectName = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const getDeleteConfirmationText = () => {
    if (!deleteTarget) return "";
    if (deleteTarget.type === "subject") return `DELETE ${deleteTarget.subject.toUpperCase()}`;
    if (deleteTarget.type === "class") return `DELETE CLASS ${deleteTarget.classLevel}`;
    return `DELETE CHAPTER ${deleteTarget.chapter}`;
  };

  const openDeleteModal = (type, subject, classLevel = null, chapter = null) => {
    setDeleteTarget({ type, subject, classLevel, chapter });
    setDeleteConfirmText("");
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== getDeleteConfirmationText()) return;
    setDeleting(true);
    try {
      let url = "";
      let confirmParam = "";
      if (deleteTarget.type === "subject") {
        url = `${API_BASE}/api/books/admin/delete-subject/${deleteTarget.subject.toLowerCase()}`;
        confirmParam = deleteTarget.subject.toLowerCase();
      } else if (deleteTarget.type === "class") {
        url = `${API_BASE}/api/books/admin/delete-class/${deleteTarget.subject.toLowerCase()}/${deleteTarget.classLevel}`;
        confirmParam = `Class ${deleteTarget.classLevel}`;
      } else {
        url = `${API_BASE}/api/books/admin/delete-chapter/${deleteTarget.subject.toLowerCase()}/${deleteTarget.classLevel}/${deleteTarget.chapter}`;
        confirmParam = `Chapter ${deleteTarget.chapter}`;
      }
      const response = await authFetch(`${url}?confirmation=${encodeURIComponent(confirmParam)}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Deleted successfully!")
        setShowDeleteModal(false);
        setDeleteTarget(null);
        fetchHierarchicalStructure();
        fetchPineconeStats();
      } else {
        toast.error("Delete failed")
      }
    } catch (err) { toast.error("Delete failed") }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <AdminLayout title="Book Management" icon={BookOpen}>
        <div className="space-y-6">
          <div className="flex gap-3">
            <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 shimmer" />
            <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-700 shimmer" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <CardLoader key={idx} rows={2} />
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="h-5 w-44 rounded bg-gray-200 dark:bg-gray-700 shimmer mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-12 rounded bg-gray-100 dark:bg-gray-700 shimmer" />
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Book Management" icon={BookOpen}>
      {}
      <div className="flex gap-3 mb-6">
        <button onClick={fetchHierarchicalStructure}
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <button onClick={() => setShowUploadModal(true)}
          className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-2 font-medium">
          <Plus className="w-4 h-4" /> Upload Book
        </button>
      </div>

      {}
      {pineconeStats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Pinecone Vector Database</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Vectors</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{pineconeStats.total_vector_count?.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Dimension</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{pineconeStats.dimension}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Namespaces</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{Object.keys(pineconeStats.namespaces || {}).length}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-gray-900 dark:text-white">Connected</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Books Library */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-gray-500 dark:text-gray-400" /> Books Library
        </h2>

        {!structure || Object.keys(structure).length === 0 ? (
          <div className="text-center py-12">
            <FileQuestion className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">No books found</p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">Upload your first book to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(structure).map(([subject, subjectData]) => (
              <div key={subject} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <button onClick={() => toggleSubject(subject)} className="flex items-center gap-3 flex-1">
                    {expandedSubjects[subject] ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                    <Book className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">{formatSubjectName(subject)}</span>
                  </button>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{subjectData.total_vectors.toLocaleString()} vectors</span>
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-xs">{Object.keys(subjectData.classes).length} classes</span>
                    <button onClick={(e) => { e.stopPropagation(); openDeleteModal("subject", subject); }}
                      className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedSubjects[subject] && (
                  <div className="bg-white dark:bg-gray-800">
                    {Object.entries(subjectData.classes).map(([classKey, classData]) => (
                      <div key={classKey} className="border-t border-gray-100 dark:border-gray-700">
                        <div className="w-full flex items-center justify-between p-4 pl-12 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                          <button onClick={() => toggleClass(subject, classKey)} className="flex items-center gap-3 flex-1">
                            {expandedClasses[`${subject}-${classKey}`] ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                            <GraduationCap className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            <span className="font-medium text-gray-700 dark:text-gray-200">Class {classData.class_level}</span>
                          </button>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{classData.vector_count.toLocaleString()} vectors</span>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs">{classData.chapters.length} ch</span>
                            <button onClick={(e) => { e.stopPropagation(); openDeleteModal("class", subject, classData.class_level); }}
                              className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {expandedClasses[`${subject}-${classKey}`] && (
                          <div className="bg-gray-50 dark:bg-gray-900/30 p-4 pl-20">
                            <div className="grid grid-cols-6 gap-3">
                              {classData.chapters.map((chapterNum) => (
                                <div key={chapterNum} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 group relative hover:shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                      <span className="font-medium text-gray-700 dark:text-gray-200">Ch. {chapterNum}</span>
                                    </div>
                                    <button onClick={() => openDeleteModal("chapter", subject, classData.class_level, chapterNum)}
                                      className="p-1 text-red-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="mt-1">
                                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> AI Ready
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border dark:border-gray-700">
            <div className="sticky top-0 bg-gray-900 text-white p-6 rounded-t-2xl">
              <h2 className="text-xl font-bold flex items-center gap-3"><Upload className="w-5 h-5" /> Upload Book Chapter</h2>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chapter Title *</label>
                <input type="text" value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class & Subject *</label>
                <select value={uploadForm.classSubject} onChange={(e) => setUploadForm({ ...uploadForm, classSubject: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                  {loadingCurriculum ? (
                    <option disabled>Loading...</option>
                  ) : classSubjectOptions.length === 0 ? (
                    <option disabled>No subjects found</option>
                  ) : (
                    classSubjectOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chapter Number *</label>
                <input type="number" min="1" max="30" value={uploadForm.chapter_number}
                  onChange={(e) => setUploadForm({ ...uploadForm, chapter_number: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">PDF File *</label>
                <input type="file" accept=".pdf" onChange={(e) => setUploadForm({ ...uploadForm, pdf_file: e.target.files[0] })}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-300" required />
              </div>
              {uploadProgress && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-900 dark:text-white" />
                    <span className="font-medium text-gray-900 dark:text-white">{uploadProgress.message}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div className="bg-gray-900 dark:bg-white h-2 rounded-full transition-all" style={{ width: `${uploadProgress.percent}%` }} />
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUploadModal(false)} disabled={uploading}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={uploading}
                  className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full border dark:border-gray-700">
        <div className="bg-red-600 text-white p-6 rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-3"><Trash2 className="w-5 h-5" /> Confirm Deletion</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300 text-sm">This action cannot be undone.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-red-600 dark:text-red-400">{getDeleteConfirmationText()}</code> to confirm:
            </label>
            <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300">Cancel</button>
            <button onClick={handleDelete} disabled={deleting || deleteConfirmText !== getDeleteConfirmationText()}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
    </AdminLayout >
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    StickyNote,
    Plus,
    Search,
    Trash2,
    Edit3,
    BookOpen,
    MessageCircle,
    Calendar,
    ArrowLeft,
    X,
    Save,
    Upload,
    Eye
} from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import useUserStore from '../stores/userStore';
import { notesService } from '../services/api';
import PdfPreviewModal from '../components/common/PdfPreviewModal';

export default function Notes() {
    const navigate = useNavigate();
    const { user } = useUserStore();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [filterSource, setFilterSource] = useState('all');
    const [showAddNote, setShowAddNote] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [newNote, setNewNote] = useState({ title: '', content: '' });
    const [pdfNotes, setPdfNotes] = useState([]);
    const [selectedPdfFiles, setSelectedPdfFiles] = useState([]);
    const [uploadingPdfs, setUploadingPdfs] = useState(false);
    const [activePdfPreview, setActivePdfPreview] = useState(null);
    const [pdfNoteDrafts, setPdfNoteDrafts] = useState({});
    const [savingPdfNoteId, setSavingPdfNoteId] = useState(null);

    const normalizeNote = (note) => {
        const looksManual = (note.highlight_text || '').trim() === '__manual__';
        const source = looksManual ? 'Manual' : 'Book to Bot';
        return {
            id: note.id,
            title: note.heading || 'Untitled Note',
            content: note.note_content || '',
            source,
            createdAt: note.created_at,
            sourceDetails: `${note.subject || 'Subject'} • Chapter ${note.chapter || 1} • Page ${note.page_number || 1}`
        };
    };

    const fetchNotes = async () => {
        if (!user?.id) return;
        setLoading(true);
        setApiError('');
        try {
            const data = await notesService.getNotes(user.id);
            const pdfData = await notesService.getPdfNotes(user.id);
            const mapped = (data?.notes || []).map(normalizeNote);
            setNotes(mapped);
            const files = pdfData?.files || [];
            setPdfNotes(files);
            setPdfNoteDrafts(
                files.reduce((acc, file) => {
                    acc[file.id] = file.note_text || '';
                    return acc;
                }, {})
            );
        } catch (error) {
            setApiError(error?.message || 'Failed to load notes');
            setNotes([]);
            setPdfNotes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, [user?.id]);

    const filteredNotes = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return notes.filter((n) => {
            const sourceMatch = filterSource === 'all' ? true : n.source === filterSource;
            if (!sourceMatch) return false;
            if (!normalizedQuery) return true;
            return (
                (n.title || '').toLowerCase().includes(normalizedQuery) ||
                (n.content || '').toLowerCase().includes(normalizedQuery)
            );
        });
    }, [notes, searchQuery, filterSource]);

    const getSourceIcon = (source) => {
        switch (source) {
            case 'Book to Bot':
                return <BookOpen className="w-4 h-4" />;
            case 'AI Chat':
                return <MessageCircle className="w-4 h-4" />;
            default:
                return <StickyNote className="w-4 h-4" />;
        }
    };

    const getSourceColor = (source) => {
        switch (source) {
            case 'Book to Bot':
                return 'bg-emerald-50 text-emerald-600';
            case 'AI Chat':
                return 'bg-orange-50 text-orange-600';
            default:
                return 'bg-amber-50 text-amber-600';
        }
    };

    const handleAddNote = () => {
        if (!(newNote.title.trim() || newNote.content.trim())) return;

        const create = async () => {
            try {
                setApiError('');
                await notesService.createNote({
                    student_id: user.id,
                    class_level: user.classLevel || 10,
                    subject: user.preferredSubject || 'General',
                    chapter: 1,
                    page_number: 1,
                    highlight_text: '__manual__',
                    heading: newNote.title || 'Untitled Note',
                    note_content: newNote.content || ''
                });
                setNewNote({ title: '', content: '' });
                setShowAddNote(false);
                await fetchNotes();
            } catch (error) {
                setApiError(error?.message || 'Failed to create note');
            }
        };

        create();
    };

    const handleUpdateNote = () => {
        if (editingNote) {
            const update = async () => {
                try {
                    setApiError('');
                    await notesService.updateNote(editingNote.id, {
                        heading: editingNote.title,
                        note_content: editingNote.content
                    });
                    setEditingNote(null);
                    await fetchNotes();
                } catch (error) {
                    setApiError(error?.message || 'Failed to update note');
                }
            };
            update();
        }
    };

    const handleDeleteNote = async (noteId) => {
        try {
            setApiError('');
            await notesService.deleteNote(noteId);
            await fetchNotes();
        } catch (error) {
            setApiError(error?.message || 'Failed to delete note');
        }
    };

    const handleUploadPdfs = async () => {
        if (!user?.id || selectedPdfFiles.length === 0) return;
        setUploadingPdfs(true);
        try {
            setApiError('');
            await notesService.uploadPdfNotes(user.id, selectedPdfFiles);
            setSelectedPdfFiles([]);
            await fetchNotes();
        } catch (error) {
            setApiError(error?.message || 'Failed to upload PDF notes');
        } finally {
            setUploadingPdfs(false);
        }
    };

    const handleDeletePdf = async (pdfId) => {
        try {
            setApiError('');
            await notesService.deletePdfNote(pdfId);
            await fetchNotes();
        } catch (error) {
            setApiError(error?.message || 'Failed to delete PDF note');
        }
    };

    const handleSavePdfNote = async (pdfId) => {
        try {
            setSavingPdfNoteId(pdfId);
            setApiError('');
            await notesService.updatePdfNote(pdfId, {
                note_text: pdfNoteDrafts[pdfId] || ''
            });
            await fetchNotes();
        } catch (error) {
            setApiError(error?.message || 'Failed to update PDF note');
        } finally {
            setSavingPdfNoteId(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Your Notes</h1>
                            <p className="text-gray-500">All your saved notes in one place</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddNote(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                    >
                        <Plus className="w-5 h-5" />
                        Add Note
                    </button>
                </div>

                {apiError && (
                    <div className="mb-4 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
                        {apiError}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Your PDF Notes</h2>
                            <p className="text-sm text-gray-500">Upload multiple personal PDFs. Only you can see them.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 text-sm">
                                <Upload className="w-4 h-4" />
                                Select PDFs
                                <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    multiple
                                    onChange={(e) => setSelectedPdfFiles(Array.from(e.target.files || []))}
                                    className="hidden"
                                />
                            </label>
                            <button
                                onClick={handleUploadPdfs}
                                disabled={uploadingPdfs || selectedPdfFiles.length === 0}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm"
                            >
                                {uploadingPdfs ? 'Uploading...' : `Upload ${selectedPdfFiles.length || ''}`.trim()}
                            </button>
                        </div>
                    </div>

                    {selectedPdfFiles.length > 0 && (
                        <p className="text-xs text-gray-500 mb-3">
                            Selected: {selectedPdfFiles.map((f) => f.name).join(', ')}
                        </p>
                    )}

                    {pdfNotes.length === 0 ? (
                        <p className="text-sm text-gray-500">No PDF notes uploaded yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {pdfNotes.map((file) => (
                                <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{file.filename}</p>
                                        <p className="text-xs text-gray-500">
                                            {(Number(file.file_size || 0) / (1024 * 1024)).toFixed(2)} MB • {new Date(file.uploaded_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActivePdfPreview(file)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Open in App
                                        </button>
                                        <button
                                            onClick={() => handleDeletePdf(file.id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                    <div className="w-full mt-2">
                                        <textarea
                                            value={pdfNoteDrafts[file.id] || ''}
                                            onChange={(e) => setPdfNoteDrafts((prev) => ({ ...prev, [file.id]: e.target.value }))}
                                            placeholder="Add notes for this PDF..."
                                            rows={2}
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                onClick={() => handleSavePdfNote(file.id)}
                                                disabled={savingPdfNoteId === file.id}
                                                className="px-3 py-1.5 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
                                            >
                                                {savingPdfNoteId === file.id ? 'Saving...' : 'Save PDF Note'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="px-4 py-3 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Sources</option>
                        <option value="Manual">Manual</option>
                        <option value="Book to Bot">Book to Bot</option>
                        <option value="AI Chat">AI Chat</option>
                    </select>
                </div>

                {/* Notes Grid */}
                {loading ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                        <p className="text-gray-500">Loading notes...</p>
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                        <StickyNote className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Notes Yet</h3>
                        <p className="text-gray-500 mb-6">Start taking notes while learning!</p>
                        <button
                            onClick={() => setShowAddNote(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                        >
                            <Plus className="w-5 h-5" />
                            Create Your First Note
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredNotes.map((note) => (
                            <div
                                key={note.id}
                                className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-lg group"
                            >
                                {}
                                <div className="flex items-start justify-between mb-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(note.source)}`}>
                                        {getSourceIcon(note.source)}
                                        {note.source}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={() => setEditingNote(note)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg"
                                        >
                                            <Edit3 className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="p-1.5 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* Note Content */}
                                <h3 className="font-semibold text-gray-800 mb-2 line-clamp-1">{note.title}</h3>
                                <p className="text-sm text-gray-600 line-clamp-3 mb-4">{note.content}</p>

                                {}
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(note.createdAt).toLocaleDateString()}
                                    {note.sourceDetails && (
                                        <span className="ml-2 text-gray-500">• {note.sourceDetails}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {}
                {showAddNote && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Add New Note</h3>
                                <button onClick={() => setShowAddNote(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Note title..."
                                value={newNote.title}
                                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            />
                            <textarea
                                placeholder="Write your note here..."
                                value={newNote.content}
                                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                                rows={6}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddNote(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {}
                {editingNote && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Edit Note</h3>
                                <button onClick={() => setEditingNote(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Note title..."
                                value={editingNote.title}
                                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            />
                            <textarea
                                placeholder="Write your note here..."
                                value={editingNote.content}
                                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                                rows={6}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingNote(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateNote}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600"
                                >
                                    <Save className="w-4 h-4" />
                                    Update Note
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <PdfPreviewModal
                open={Boolean(activePdfPreview)}
                fileUrl={activePdfPreview?.file_url}
                title={activePdfPreview?.filename}
                onClose={() => setActivePdfPreview(null)}
            />
        </DashboardLayout>
    );
}

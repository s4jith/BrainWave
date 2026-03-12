import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { 
  StickyNote, 
  X, 
  Edit, 
  Trash2, 
  Save,
  Plus
} from "lucide-react";
import useUserStore from "../../stores/userStore";
import authFetch from "../../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function NoteTaker({ currentLesson, pageNumber, onClose }) {
  const { user } = useUserStore();
  const [notes, setNotes] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({
    heading: "",
    note_content: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentLesson && user) {
      fetchNotes();
    }
  }, [currentLesson, pageNumber, user]);

  const fetchNotes = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        class_level: user.classLevel.toString(),
        subject: currentLesson.subject,
        chapter: currentLesson.number.toString(),
        page_number: pageNumber.toString(),
      });

      const response = await authFetch(
        `${API_BASE}/api/notes/${user.id}?${params}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notes");
      }

      const data = await response.json();
      
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteForm.note_content.trim()) {
      setError("Note content is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const noteData = {
        student_id: user.id,
        class_level: user.classLevel,
        subject: currentLesson.subject,
        chapter: currentLesson.number,
        page_number: pageNumber,
        heading: noteForm.heading || `Page ${pageNumber} Note`,
        note_content: noteForm.note_content,
        highlight_text: "", 
      };

      const response = await authFetch(`${API_BASE}/api/notes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error("Failed to create note");
      }

      const createdNote = await response.json();
      setNotes([...notes, createdNote]);
      setNoteForm({ heading: "", note_content: "" });
      setIsCreating(false);
    } catch (err) {
      console.error("Error creating note:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNote = async (noteId) => {
    if (!noteForm.note_content.trim()) {
      setError("Note content is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updateData = {
        heading: noteForm.heading,
        note_content: noteForm.note_content,
      };

      const response = await authFetch(`${API_BASE}/api/notes/${noteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error("Failed to update note");
      }

      const updatedNote = await response.json();
      setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
      setNoteForm({ heading: "", note_content: "" });
      setEditingNote(null);
    } catch (err) {
      console.error("Error updating note:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Are you sure you want to delete this note?")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`${API_BASE}/api/notes/${noteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete note");
      }

      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Error deleting note:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (note) => {
    setEditingNote(note.id);
    setNoteForm({
      heading: note.heading || "",
      note_content: note.note_content || "",
    });
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setIsCreating(false);
    setNoteForm({ heading: "", note_content: "" });
    setError(null);
  };

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-md animate-in slide-in-from-left-4 duration-300">
      {}
      <div className="bg-card border rounded-t-2xl shadow-xl px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-yellow-600" />
          Notes (Page {pageNumber})
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            title="Close notes panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {}
      {notes.length > 0 && !isCreating && !editingNote && (
        <div className="bg-card border-x border-b rounded-b-2xl shadow-xl p-4 max-h-80 overflow-y-auto">
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
              >
                {note.heading && (
                  <h4 className="font-medium text-sm mb-1">{note.heading}</h4>
                )}
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {note.note_content}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => startEdit(note)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Note Form */}
      {(isCreating || editingNote) && (
        <div className="bg-card border-x border-b rounded-b-2xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-200">
          <h4 className="font-medium text-sm mb-3">
            {editingNote ? "Edit Note" : "New Note"}
          </h4>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-2 rounded mb-3">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Heading (optional)"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={noteForm.heading}
              onChange={(e) =>
                setNoteForm({ ...noteForm, heading: e.target.value })
              }
            />
            <textarea
              placeholder="Write your note here..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[120px] resize-y"
              value={noteForm.note_content}
              onChange={(e) =>
                setNoteForm({ ...noteForm, note_content: e.target.value })
              }
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() =>
                  editingNote
                    ? handleUpdateNote(editingNote)
                    : handleCreateNote()
                }
                disabled={isLoading || !noteForm.note_content.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? "Saving..." : "Save Note"}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state - show Add Note button */}
      {notes.length === 0 && !isCreating && !editingNote && (
        <div className="bg-card border-x border-b rounded-b-2xl shadow-xl p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">No notes yet for this page</p>
          <Button
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      )}

      {/* Add More Notes Button (when notes exist) */}
      {notes.length > 0 && !isCreating && !editingNote && (
        <div className="bg-card border-x border-b rounded-b-2xl shadow-xl px-4 py-3">
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Note
          </Button>
        </div>
      )}
    </div>
  );
}

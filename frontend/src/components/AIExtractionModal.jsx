
import { useState } from "react";
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import useUserStore from "../stores/userStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AIExtractionModal({ isOpen, onClose, onSuccess }) {
  const { user } = useUserStore();
  
  const [uploading, setUploading] = useState(false);
  const [extractionForm, setExtractionForm] = useState({
    subject_name: "",
    class_level: 10
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload PDF, JPEG, PNG, or WebP files.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size too large. Maximum 10MB allowed.");
      return;
    }

    setSelectedFile(file);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    if (!extractionForm.subject_name.trim()) {
      setError("Please enter a subject name");
      return;
    }

    setUploading(true);
    setError("");
    setExtractionResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("subject_name", extractionForm.subject_name);
      formData.append("class_level", extractionForm.class_level);
      formData.append("board", "CBSE");
      formData.append("uploaded_by", user?.user_id || "admin");

      const response = await fetch(`${API_URL}/api/curriculum/extract-from-upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setExtractionResult(result);
        
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Extraction failed");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      setError("Failed to extract curriculum. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setExtractionResult(null);
      setError("");
      setExtractionForm({
        subject_name: "",
        class_level: 10
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                AI-Powered Extraction
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload table of contents to auto-generate curriculum
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {}
        <div className="p-6">
          {extractionResult ? (
            
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Extraction Successful!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Successfully extracted {extractionResult.extracted_chapters?.length || 0} chapters
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  📋 The extracted curriculum is now in the <strong>Pending Review</strong> section.
                  Please review and approve it to add it to the system.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Subject Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={extractionForm.subject_name}
                    onChange={(e) => setExtractionForm({ ...extractionForm, subject_name: e.target.value })}
                    placeholder="e.g., English, Mathematics, Science"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    required
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Level *
                  </label>
                  <select
                    value={extractionForm.class_level}
                    onChange={(e) => setExtractionForm({ ...extractionForm, class_level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    required
                    disabled={uploading}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(cls => (
                      <option key={cls} value={cls}>Class {cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Table of Contents *
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition
                    ${dragActive
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                    }
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {!uploading && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        Drag and drop your file here, or
                      </p>
                      <label className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition">
                        <Upload className="w-4 h-4 mr-2" />
                        Browse Files
                        <input
                          type="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        Supported: PDF, JPEG, PNG, WebP (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">How it works:</p>
                    <ul className="space-y-1 text-xs">
                      <li>1. Upload a PDF or image of the table of contents</li>
                      <li>2. AI extracts chapters, topics, and page numbers</li>
                      <li>3. Review and approve the extracted structure</li>
                      <li>4. Subject is created automatically</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !extractionForm.subject_name.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Extract with AI
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  FileText,
  Download,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Loader2,
  Calendar,
  User,
  MessageSquare,
  Lock,
  Timer
} from "lucide-react";
import { Button } from "../ui/button";
import { testService } from "../../services/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * StaffTestCard Component
 * 
 * Displays a staff-assigned test with download/upload functionality.
 * Only allows download/upload within the start_date and due_date window.
 */

export default function StaffTestCard({ test, studentId, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Current time for comparison
  const now = new Date();
  const startDate = test.start_date ? new Date(test.start_date) : null;
  const dueDate = test.due_date ? new Date(test.due_date) : null;

  // Determine if test is within active window
  const isBeforeStart = startDate && now < startDate;
  const isAfterDue = dueDate && now > dueDate;
  const isWithinWindow = !isBeforeStart && !isAfterDue;

  // Determine status based on submission data
  const getTestStatus = () => {
    if (test.has_feedback) return "evaluated";
    if (test.has_submitted) return "submitted";
    return "pending";
  };

  const testStatus = getTestStatus();

  // Get timing status
  const getTimingStatus = () => {
    if (isBeforeStart) return "upcoming";
    if (isAfterDue) return "closed";
    return "active";
  };

  const timingStatus = getTimingStatus();

  const getStatusBadge = () => {
    switch (testStatus) {
      case "pending":
        if (isBeforeStart) {
          return (
            <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              <Timer className="w-3 h-3" />
              Upcoming
            </span>
          );
        }
        if (isAfterDue) {
          return (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              <Lock className="w-3 h-3" />
              Missed
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Active
          </span>
        );
      case "submitted":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Submitted
          </span>
        );
      case "evaluated":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <MessageSquare className="w-3 h-3" />
            Feedback Available
          </span>
        );
      default:
        return null;
    }
  };

  const handleDownloadPaper = () => {
    if (!isWithinWindow && testStatus === "pending") {
      setUploadError("Test is not available at this time");
      return;
    }
    // Open question paper PDF using the new API endpoint
    const pdfUrl = `${API_BASE}/api/tests/pdf/${test.pdf_filename}`;
    window.open(pdfUrl, "_blank");
  };

  const handleUploadAnswer = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if within time window
    if (!isWithinWindow) {
      setUploadError("Submissions are only allowed during the test window");
      return;
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    setUploadError(null);

    // Debug: Show what we're sending
    const testId = test.id;
    console.log("� UPLOAD DEBUG:", { testId, studentId, fileName: file.name });
    alert(`Uploading: testId=${testId}, studentId=${studentId}, file=${file.name}`);

    try {
      const formData = new FormData();
      formData.append("test_id", testId);
      formData.append("student_id", studentId);
      formData.append("pdf_file", file);

      const response = await fetch(`${API_BASE}/api/tests/submit`, {
        method: "POST",
        body: formData
      });

      const responseData = await response.json().catch(() => ({}));
      console.log("📥 RESPONSE:", response.status, responseData);

      if (!response.ok) {
        console.error("❌ Upload Error:", responseData);
        alert(`Upload Error: ${JSON.stringify(responseData)}`);
        throw new Error(responseData.detail || JSON.stringify(responseData) || "Upload failed");
      }

      alert("✅ Upload successful!");
      onRefresh();
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadError(error.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleString();
  };

  const isOverdue = dueDate && now > dueDate && testStatus === "pending";

  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border transition-all hover:shadow-md ${isOverdue ? "border-red-200" : isBeforeStart ? "border-blue-200" : "border-gray-100"
      }`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Test Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-xl ${testStatus === "evaluated" ? "bg-green-100" :
            testStatus === "submitted" ? "bg-orange-100" : "bg-amber-100"
            }`}>
            <FileText className={`w-6 h-6 ${testStatus === "evaluated" ? "text-green-600" :
              testStatus === "submitted" ? "text-orange-600" : "text-amber-600"
              }`} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-800">{test.title}</h3>
              {getStatusBadge()}
            </div>

            {test.description && (
              <p className="text-sm text-gray-600 mb-2">{test.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
              <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {test.subject}
              </span>
              {test.start_date && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Timer className="w-3.5 h-3.5" />
                  Starts: {formatDateTime(test.start_date)}
                </span>
              )}
              {test.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Due: {formatDateTime(test.due_date)}
                </span>
              )}
              {test.submission_date && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Submitted: {formatDate(test.submission_date)}
                </span>
              )}
            </div>

            {/* Upcoming Notice */}
            {isBeforeStart && testStatus === "pending" && (
              <div className="flex items-center gap-2 text-orange-600 text-sm mb-2 bg-orange-50 p-2 rounded-lg">
                <Timer className="w-4 h-4" />
                <span>Test will be available on {formatDateTime(test.start_date)}</span>
              </div>
            )}

            {/* Overdue Warning */}
            {isOverdue && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-2 bg-red-50 p-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>Test window has closed. You missed the deadline.</span>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2">
          {/* Download Question Paper - only enabled during test window or after submission */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPaper}
            disabled={isBeforeStart && testStatus === "pending"}
            className="gap-2"
          >
            {isBeforeStart && testStatus === "pending" ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Question Paper
          </Button>

          {/* Upload Answer Sheet (only if pending AND within time window) */}
          {testStatus === "pending" && isWithinWindow && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleUploadAnswer}
                className="hidden"
                disabled={uploading}
              />
              <div className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md w-full ${uploading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                }`}>
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? "Uploading..." : "Upload Answer"}
              </div>
            </label>
          )}

          {/* Show locked message if pending but outside time window */}
          {testStatus === "pending" && !isWithinWindow && (
            <div className="text-center text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
              <Lock className="w-4 h-4 mx-auto mb-1 text-gray-400" />
              {isBeforeStart ? "Not yet available" : "Submission closed"}
            </div>
          )}

          {/* View Feedback (if evaluated) */}
          {testStatus === "evaluated" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = `/my-tests?submission=${test.submission_id}`}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Eye className="w-4 h-4" />
              View Feedback
            </Button>
          )}

          {/* Submitted confirmation */}
          {testStatus === "submitted" && (
            <div className="text-center text-sm text-orange-600">
              Awaiting feedback
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

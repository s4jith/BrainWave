import React, { useEffect, useState } from "react";
import { History, StickyNote, Sparkles, Trash2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import useAnnotationStore from "../../stores/annotationStore";
import useUserStore from "../../stores/userStore";
import ReactMarkdown from "react-markdown";

const ExpandableText = ({ text, limit = 600 }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > limit;
  const displayText = expanded || !isLong ? text : text.slice(0, limit) + "...";

  return (
    <div>
      <div className={`text-sm ${expanded ? '' : 'line-clamp-4'}`}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      {isLong && (
        <Button
          variant="link"
          size="sm"
          className="px-0 h-auto mt-1 text-xs text-violet-600"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <span className="flex items-center gap-1">Show Less <ChevronUp className="h-3 w-3" /></span>
          ) : (
            <span className="flex items-center gap-1">Show More <ChevronDown className="h-3 w-3" /></span>
          )}
        </Button>
      )}
    </div>
  );
};

export default function HistoryPanel({ open, onClose, currentLesson }) {
  const {
    getAnnotationsByLesson,
    deleteAnnotation,
    fetchAnnotations,
    loading
  } = useAnnotationStore();

  const { user } = useUserStore();

  useEffect(() => {
    if (open && user?.id && currentLesson) {
      fetchAnnotations(
        user.id,
        user.classLevel,
        currentLesson.subject,
        currentLesson.number
      );
    }
  }, [open, user, currentLesson, fetchAnnotations]);

  const lessonAnnotations = currentLesson
    ? getAnnotationsByLesson(currentLesson.number) 
    : [];

  const annotations = lessonAnnotations.length > 0
    ? lessonAnnotations
    : (currentLesson ? getAnnotationsByLesson(currentLesson.id) : []);

  const noteAnnotations = annotations.filter((a) => a.type === "note");
  const aiAnnotations = annotations.filter((a) => a.type === "ai");

  const formatDate = (timestamp) => {
    try {
      
      let date;
      if (typeof timestamp === 'string') {
        
        const utcTimestamp = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
        date = new Date(utcTimestamp);
      } else {
        date = new Date(timestamp);
      }

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch (e) {
      return "Just now";
    }
  };

  const handleDelete = (id, type) => {
    if (confirm("Are you sure you want to delete this annotation?")) {
      deleteAnnotation(id, type);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        onClose={onClose}
        className="w-[600px] max-w-[90vw]"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Annotations History
            {loading && <span className="text-xs font-normal text-muted-foreground ml-2">(Syncing...)</span>}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-6 pr-4">

            {/* AI Annotations Section (Prioritized) */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="font-semibold text-sm">
                  AI Annotations ({aiAnnotations.length})
                </h3>
              </div>

              {aiAnnotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                  No AI annotations saved yet
                </p>
              ) : (
                <div className="space-y-4">
                  {aiAnnotations.map((annotation) => (
                    <Card
                      key={annotation.id}
                      className="p-4 border-l-4 border-l-violet-500 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Badge variant="ai" className="capitalize bg-violet-100 text-violet-700 hover:bg-violet-200">
                          {annotation.action?.replace('_', ' ') || 'AI Assist'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(annotation.id, "ai")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="bg-muted/30 rounded p-3 mb-3 border border-muted">
                        <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                          Selected Text
                        </p>
                        <p className="text-sm italic text-foreground/80 line-clamp-2">
                          "{annotation.text}"
                        </p>
                      </div>

                      {annotation.response && (
                        <div className="mt-2 bg-violet-50 dark:bg-violet-950/20 rounded-lg p-3">
                          <p className="text-xs font-semibold text-violet-600 mb-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> AI Response
                          </p>
                          <div className="text-sm text-foreground/90">
                            <ExpandableText text={annotation.response} limit={600} />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(annotation.timestamp)}
                        </div>
                        <div>
                          Page {annotation.pageNumber}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <StickyNote className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-sm">
                  Personal Notes ({noteAnnotations.length})
                </h3>
              </div>

              {noteAnnotations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
                  No notes saved yet
                </p>
              ) : (
                <div className="space-y-4">
                  {noteAnnotations.map((annotation) => (
                    <Card
                      key={annotation.id}
                      className="p-4 border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm text-green-900 dark:text-green-100">
                          {annotation.heading}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(annotation.id, "note")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatDate(annotation.timestamp)} • Page {annotation.pageNumber}
                      </div>

                      <div className="bg-muted/30 rounded p-2 mb-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Excerpt:
                        </p>
                        <p className="text-sm line-clamp-2 italic">
                          "{annotation.text}"
                        </p>
                      </div>

                      {annotation.content && (
                        <div className="mt-2 text-sm whitespace-pre-wrap">
                          {annotation.content}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

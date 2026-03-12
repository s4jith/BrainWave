/**
 * QuestionImageRenderer
 *
 * Renders question text that may contain [img:IMAGE_ID] placeholders.
 * Each placeholder is replaced with the actual image fetched from the backend.
 *
 * Usage:
 *   <QuestionImageRenderer text={question.text} />
 *
 * Syntax inside question text:
 *   "The diagram below [img:550e8400-e29b-41d4-a716-446655440000] shows..."
 */

import React from "react";

const apiUrl = import.meta.env.VITE_API_URL;

// Matches [img:<valid-uuid>]
const IMG_TAG_REGEX = /\[img:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

const QuestionImageRenderer = ({ text, className = "", imgClassName = "" }) => {
    if (!text) return null;

    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    // Reset regex state
    IMG_TAG_REGEX.lastIndex = 0;

    while ((match = IMG_TAG_REGEX.exec(text)) !== null) {
        // Text before this match
        if (match.index > lastIndex) {
            parts.push(
                <span key={key++}>{text.slice(lastIndex, match.index)}</span>
            );
        }
        // The image
        const imageId = match[1];
        parts.push(
            <img
                key={key++}
                src={`${apiUrl}/api/question-bank/images/${imageId}`}
                alt="Question illustration"
                className={
                    imgClassName ||
                    "inline-block max-w-full max-h-72 my-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                }
                onError={(e) => {
                    e.target.style.display = "none";
                }}
            />
        );
        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last match
    if (lastIndex < text.length) {
        parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }

    if (parts.length === 0) return <span className={className}>{text}</span>;

    return <span className={className}>{parts}</span>;
};

export default QuestionImageRenderer;

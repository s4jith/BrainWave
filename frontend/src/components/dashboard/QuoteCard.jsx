import { useState, useEffect } from "react";
import { Quote } from "lucide-react";
import quotesData from "../../data/quotes.json";

/**
 * QuoteCard Component
 * 
 * Displays the quote of the day based on the current date.
 */

export default function QuoteCard() {
  const [currentQuote, setCurrentQuote] = useState(null);

  useEffect(() => {
    // Get current day of the month (1-31)
    const day = new Date().getDate();
    // Map to 0-based index
    // Use modulo to wrap around if we have fewer quotes than days (though we have 31)
    const quoteIndex = (day - 1) % quotesData.quotes.length;
    setCurrentQuote(quotesData.quotes[quoteIndex]);
  }, []);

  if (!currentQuote) return null;

  return (
    <div
      className="rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      {/* Decorative Quote Icon */}
      <Quote className="absolute top-4 right-4 w-12 h-12 text-white/20" />

      <div className="relative z-10">
        <p className="text-white text-lg font-medium leading-relaxed mb-4">
          "{currentQuote.text}"
        </p>
        <p className="text-white/80 text-sm">
          — {currentQuote.author}
        </p>
      </div>
    </div>
  );
}

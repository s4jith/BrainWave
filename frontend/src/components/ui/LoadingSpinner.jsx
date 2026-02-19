
import { BookOpen, Loader2 } from "lucide-react";

export default function LoadingSpinner({ message = "Loading...", submessage = "Please wait" }) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors">
            <div className="text-center">
                {}
                <div className="relative w-24 h-24 mx-auto mb-6">
                    {}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-orange-500 dark:text-orange-400 animate-pulse" />
                    </div>
                    {/* Rotating rings */}
                    <div className="absolute inset-0 border-4 border-transparent border-t-orange-500 dark:border-t-orange-400 rounded-full animate-spin" />
                    <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin-slow" 
                         style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{message}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{submessage}</p>
            </div>
        </div>
    );
}

export function LoadingSpinnerCompact({ size = "default" }) {
    const sizeClasses = {
        small: "w-16 h-16",
        default: "w-24 h-24",
        large: "w-32 h-32"
    };

    const iconSizes = {
        small: 12,
        default: 16,
        large: 20
    };

    return (
        <div className="flex items-center justify-center p-8">
            <div className={`relative ${sizeClasses[size]}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen size={iconSizes[size]} className="text-orange-500 dark:text-orange-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 border-4 border-transparent border-t-orange-500 dark:border-t-orange-400 rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" 
                     style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
            </div>
        </div>
    );
}

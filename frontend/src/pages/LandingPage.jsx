

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Brain,
    Target,
    BarChart3,
    MessageCircle,
    Sparkles,
    ChevronRight,
    Zap,
    Users,
    ArrowRight,
    Clock
} from 'lucide-react';

// Testimonial data
const testimonials = [
    {
        text: "Brainwave transformed how I study. The AI-powered book assistant helps me understand complex concepts in seconds!",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sahana&backgroundColor=b6e3f4",
        name: "Sahana",
        role: "Class 12 Student",
    },
    {
        text: "The personalized learning path keeps me motivated. I improved my scores by 40% in just two months!",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Karthiban&backgroundColor=c0aede",
        name: "Karthiban",
        role: "Class 11 Student",
    },
    {
        text: "Love how I can chat with any textbook. It's like having a personal tutor available 24/7!",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kavin&backgroundColor=d1d4f9",
        name: "Kavin",
        role: "Class 10 Student",
    },
    {
        text: "The test analytics helped me identify my weak areas. Now I study smarter, not harder!",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mithran&backgroundColor=ffd5dc",
        name: "Mithran",
        role: "Class 12 Student",
    },
    {
        text: "Best educational platform I've used. The interface is clean and the AI responses are incredibly helpful.",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sajith&backgroundColor=c9f0db",
        name: "Sajith",
        role: "Class 11 Student",
    },
];

// Features data
const features = [
    { icon: BookOpen, title: "Book to Bot", description: "Upload any textbook and chat with it." },
    { icon: Brain, title: "AI-Powered Learning", description: "Personalized explanations tailored to you." },
    { icon: Target, title: "Smart Tests", description: "Adaptive tests based on your performance." },
    { icon: BarChart3, title: "Progress Analytics", description: "Track your strengths and weaknesses." },
    { icon: MessageCircle, title: "24/7 Doubt Support", description: "Get answers anytime, anywhere." },
    { icon: Sparkles, title: "Personalized Path", description: "AI creates your custom learning path." },
];

// Navbar Component
const Navbar = () => {
    const navigate = useNavigate();

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-200"
        >
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-neutral-900">Brainwave</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/login')}
                        className="px-5 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
                    >
                        Login
                    </button>
                    <button
                        onClick={() => navigate('/signup')}
                        className="px-5 py-2 text-sm font-medium bg-neutral-900 text-white rounded-full hover:bg-neutral-800 transition-colors"
                    >
                        Sign Up
                    </button>
                </div>
            </div>
        </motion.nav>
    );
};

// Dashboard Content Panel (inside the screen)
const DashboardPanel = () => {
    return (
        <div className="w-full h-full flex-shrink-0 bg-gradient-to-br from-neutral-50 to-neutral-100 p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-semibold text-neutral-900 text-sm">Brainwave Dashboard</p>
                        <p className="text-xs text-neutral-500">Welcome back, Student</p>
                    </div>
                </div>
                <div className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">5 day streak 🔥</div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <BookOpen className="w-6 h-6 text-neutral-700 mb-3" />
                    <p className="text-sm font-medium text-neutral-900">Book to Bot</p>
                    <p className="text-xs text-neutral-500 mt-1">3 books uploaded</p>
                    <div className="mt-3 h-1.5 bg-neutral-100 rounded-full">
                        <div className="h-full w-3/4 bg-neutral-900 rounded-full"></div>
                    </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <Brain className="w-6 h-6 text-neutral-700 mb-3" />
                    <p className="text-sm font-medium text-neutral-900">AI Chats</p>
                    <p className="text-xs text-neutral-500 mt-1">127 conversations</p>
                    <div className="mt-3 h-1.5 bg-neutral-100 rounded-full">
                        <div className="h-full w-1/2 bg-neutral-900 rounded-full"></div>
                    </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <Target className="w-6 h-6 text-neutral-700 mb-3" />
                    <p className="text-sm font-medium text-neutral-900">Tests Taken</p>
                    <p className="text-xs text-neutral-500 mt-1">24 completed</p>
                    <div className="mt-3 h-1.5 bg-neutral-100 rounded-full">
                        <div className="h-full w-2/3 bg-neutral-900 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-neutral-900">Progress</p>
                        <BarChart3 className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div className="flex-1 flex items-end gap-2">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                            <div key={i} className="flex-1 bg-neutral-100 rounded-t" style={{ height: `${h}%` }}>
                                <div className="w-full bg-neutral-900 rounded-t" style={{ height: '60%' }}></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-neutral-900">Recent</p>
                        <Clock className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg">
                            <div className="w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-4 h-4 text-neutral-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-neutral-900">Physics Ch. 5</p>
                                <p className="text-[10px] text-neutral-500">2 min ago</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-neutral-50 rounded-lg">
                            <div className="w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-neutral-600" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-neutral-900">AI Doubt Solved</p>
                                <p className="text-[10px] text-neutral-500">15 min ago</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Features Panel (inside the screen)
const FeaturesPanel = ({ navigate }) => {
    return (
        <div className="w-full h-full flex-shrink-0 bg-neutral-50 p-6 flex flex-col">
            <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-full uppercase mb-2">
                    Features
                </span>
                <h2 className="text-2xl font-bold text-neutral-900">Everything you need</h2>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                    <motion.div
                        key={index}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => navigate('/login')}
                        className="p-4 bg-white rounded-xl border border-neutral-200 cursor-pointer group transition-all hover:shadow-lg"
                    >
                        <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-neutral-900 transition-colors">
                            <feature.icon className="w-5 h-5 text-neutral-700 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="font-semibold text-neutral-900 text-sm mb-1">{feature.title}</h3>
                        <p className="text-xs text-neutral-500">{feature.description}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// Testimonials Panel (inside the screen) - with auto-scroll
const TestimonialsPanel = () => {
    return (
        <div className="w-full h-full flex-shrink-0 bg-white p-6 flex flex-col overflow-hidden">
            <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-full uppercase mb-2">
                    Testimonials
                </span>
                <h2 className="text-2xl font-bold text-neutral-900">Loved by students</h2>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
                {/* Column 1 */}
                <motion.div
                    animate={{ y: [0, -50 * testimonials.length] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="flex flex-col gap-3"
                >
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 w-48 flex-shrink-0">
                            <p className="text-xs text-neutral-600 mb-3">"{t.text}"</p>
                            <div className="flex items-center gap-2">
                                <img src={t.image} alt={t.name} className="w-6 h-6 rounded-full" />
                                <div>
                                    <p className="text-xs font-semibold text-neutral-900">{t.name}</p>
                                    <p className="text-[10px] text-neutral-500">{t.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Column 2 */}
                <motion.div
                    animate={{ y: [-50 * testimonials.length, 0] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="flex flex-col gap-3"
                >
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 w-48 flex-shrink-0">
                            <p className="text-xs text-neutral-600 mb-3">"{t.text}"</p>
                            <div className="flex items-center gap-2">
                                <img src={t.image} alt={t.name} className="w-6 h-6 rounded-full" />
                                <div>
                                    <p className="text-xs font-semibold text-neutral-900">{t.name}</p>
                                    <p className="text-[10px] text-neutral-500">{t.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Column 3 */}
                <motion.div
                    animate={{ y: [0, -50 * testimonials.length] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="flex flex-col gap-3 hidden md:flex"
                >
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <div key={i} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 w-48 flex-shrink-0">
                            <p className="text-xs text-neutral-600 mb-3">"{t.text}"</p>
                            <div className="flex items-center gap-2">
                                <img src={t.image} alt={t.name} className="w-6 h-6 rounded-full" />
                                <div>
                                    <p className="text-xs font-semibold text-neutral-900">{t.name}</p>
                                    <p className="text-[10px] text-neutral-500">{t.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

// CTA Panel (inside the screen) - leads to login
const CTAPanel = ({ navigate }) => {
    return (
        <div className="w-full h-full flex-shrink-0 bg-neutral-900 p-6 flex flex-col items-center justify-center text-center">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-7 h-7 text-neutral-900" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                    Ready to start?
                </h2>
                <p className="text-neutral-400 mb-8 max-w-xs">
                    Join thousands of students learning smarter with Brainwave.
                </p>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-full font-semibold hover:bg-neutral-100 transition-colors"
                >
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                </motion.button>
            </motion.div>
        </div>
    );
};

// Footer
const Footer = () => {
    const navigate = useNavigate();

    const footerLinks = {
        Product: ['Features', 'Pricing', 'Book to Bot', 'AI Tutor'],
        Resources: ['Help Center', 'Blog', 'Tutorials', 'FAQ'],
        Company: ['About Us', 'Careers', 'Contact', 'Press'],
        Legal: ['Privacy', 'Terms', 'Cookies'],
    };

    return (
        <footer className="bg-neutral-950 text-white py-12 px-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-neutral-900" />
                            </div>
                            <span className="text-lg font-bold">Brainwave</span>
                        </div>
                        <p className="text-sm text-neutral-400">AI-powered learning for everyone.</p>
                    </div>

                    {Object.entries(footerLinks).map(([title, links]) => (
                        <div key={title}>
                            <h4 className="font-semibold text-sm mb-3">{title}</h4>
                            <ul className="space-y-2">
                                {links.map((link) => (
                                    <li key={link}>
                                        <span
                                            onClick={() => navigate('/login')}
                                            className="text-sm text-neutral-400 hover:text-white cursor-pointer transition-colors"
                                        >
                                            {link}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-neutral-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-neutral-500">© 2025 Brainwave. All rights reserved.</p>
                    <p className="text-sm text-neutral-500">Built with ❤️ by <span className="text-white font-medium">4%</span></p>
                </div>
            </div>
        </footer>
    );
};

// Main Landing Page with Screen that has horizontal scrolling content inside
export default function LandingPage() {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
    });

    // Screen animation phases:
    // 0-0.15: Screen tilt reduces (rotateX: 20 -> 0)
    // 0.15-1: Horizontal scroll inside the screen
    const rotate = useTransform(scrollYProgress, [0, 0.15], [20, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.15], [1.05, 1]);
    const translateY = useTransform(scrollYProgress, [0, 0.15], [0, -100]);

    // Horizontal scroll inside the screen (after tilt animation)
    // 4 panels, so -300%
    const innerX = useTransform(scrollYProgress, [0.15, 1], ['0%', '-300%']);

    return (
        <div className="bg-white">
            <Navbar />

            {/* Main scroll container */}
            <div ref={containerRef} className="h-[500vh] relative">
                <div className="sticky top-0 h-screen flex items-center justify-center pt-16 overflow-hidden">
                    <div className="w-full max-w-5xl mx-auto px-4 md:px-8">
                        {/* Title above the screen */}
                        <motion.div
                            style={{ translateY }}
                            className="text-center mb-8"
                        >
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-sm font-medium text-neutral-500 mb-3 tracking-wider uppercase"
                            >
                                Welcome to the future of learning
                            </motion.p>
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl md:text-5xl font-bold text-neutral-900 mb-2"
                            >
                                Learn Smarter with
                            </motion.h1>
                            <motion.span
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-neutral-900 via-neutral-600 to-neutral-400 bg-clip-text text-transparent"
                            >
                                AI-Powered Education
                            </motion.span>
                        </motion.div>

                        {/* The Screen - with 3D tilt and horizontal scroll inside */}
                        <motion.div
                            style={{
                                rotateX: rotate,
                                scale,
                                transformPerspective: 1000,
                                boxShadow: "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
                            }}
                            className="w-full h-[28rem] md:h-[36rem] border-4 border-neutral-300 bg-neutral-100 rounded-[24px] overflow-hidden"
                        >
                            {/* Browser bar */}
                            <div className="bg-white border-b border-neutral-200 px-4 py-2 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                <span className="ml-4 text-xs text-neutral-400">brainwave.edu</span>
                            </div>

                            {/* Content area with horizontal scroll */}
                            <div className="h-[calc(100%-40px)] overflow-hidden">
                                <motion.div
                                    style={{ x: innerX }}
                                    className="flex h-full"
                                >
                                    <DashboardPanel />
                                    <FeaturesPanel navigate={navigate} />
                                    <TestimonialsPanel />
                                    <CTAPanel navigate={navigate} />
                                </motion.div>
                            </div>
                        </motion.div>

                        {/* Scroll indicator */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                            className="text-center mt-6"
                        >
                            <p className="text-sm text-neutral-400 flex items-center justify-center gap-2">
                                Scroll to explore <ChevronRight className="w-4 h-4 animate-pulse" />
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import useUserStore from "../stores/userStore";
import { AnimatedCharacters } from "../components/ui/animated-characters";
import { Slack } from "lucide-react";
import authFetch from "../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useUserStore();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTypingPassword, setIsTypingPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const res = await authFetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password: password })
      });
      const data = await res.json();

      if (data.success) {
        const userRole = data.user.role || "student";

        login({
          id: data.user.id,
          user_id: data.user.user_id,
          name: data.user.name,
          email: data.user.email,
          role: userRole,
          classLevel: data.user.class_level || null,
          subjects: data.user.subjects || [],
          isOnboarded: data.user.is_onboarded !== false,
          permissions: data.user.permissions || []
        }, data.access_token);

        if (userRole === "admin") {
          navigate("/admin-dashboard");
        } else if (userRole === "teacher") {
          navigate("/teacher-dashboard");
        } else if (userRole === "head") {
          navigate("/head-dashboard");
        } else {
          
          if (data.user.is_onboarded) {
            navigate("/dashboard");
          } else {
            navigate("/onboarding");
          }
        }
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed. Please check your credentials and ensure the server is running.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-white page-animate">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-between bg-slate-50 py-12">
        <div className="mb-2 flex items-center gap-2 relative right-[150px]">
          <Slack />
          <h1 className="text-3xl font-bold tracking-wide" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#ef4444" }}>
            THE BRAINWAVE
          </h1>
          <p className="absolute -bottom-[60px] left-12 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            Synchronizing minds with smarter learning. Built for focus, clarity, and growth.
          </p>
        </div>
        <div>
          <AnimatedCharacters password={password} showPassword={showPassword} isTyping={isTypingPassword} />
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome back!</h1>
            <p className="text-gray-500">Sign in with your User ID and password to continue.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Your User ID or Email"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full h-14 px-5 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsTypingPassword(true)}
                onBlur={() => setIsTypingPassword(false)}
                className="w-full h-14 px-5 pr-12 bg-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-left">
              <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm text-green-500 hover:text-green-600">Forgot password?</button>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={isLoading} className="w-full h-14 mt-4 font-semibold rounded-2xl bg-gray-900 hover:bg-gray-800 text-white transition-colors">
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div className="text-center mt-10 text-gray-400 text-sm">
            <p>Please contact your administrator if you need an account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Wrench, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useUserStore from "../stores/userStore";

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { logout } = useUserStore();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Under Maintenance
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          The platform is currently undergoing scheduled maintenance.
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          Please try again later. We'll be back shortly.
        </p>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 font-medium transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

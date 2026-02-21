
import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
    Settings, Database, Globe,
    Save, Check, Loader2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const DEFAULT_SETTINGS = {
    platformName: "NCERT Learning Platform",
    platformDescription: "Interactive learning platform for NCERT curriculum",
    maintenanceMode: false,
    backupFrequency: "daily",
    retentionDays: 30,
};

export default function AdminSettings() {
    const { user, getAuthHeader } = useUserStore();
    const [activeSection, setActiveSection] = useState("general");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/settings`, {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings({ ...DEFAULT_SETTINGS, ...data });
                }
            } catch (err) {
                setLoadError("Failed to load settings.");
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert(data.error || "Failed to save settings.");
            }
        } catch (err) {
            alert("Network error saving settings.");
        } finally {
            setSaving(false);
        }
    };

    const sections = [
        { id: "general", label: "General", icon: Globe },
        { id: "database", label: "Database", icon: Database },
    ];

    return (
        <AdminLayout title="Settings" icon={Settings}>
            {loadError && (
                <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm border border-red-200 dark:border-red-800">
                    {loadError}
                </div>
            )}
            <div className="flex justify-end mb-6 gap-4">
                {saved && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <Check className="w-4 h-4" />
                        <span>Settings saved</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 text-sm font-medium transition"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="max-w-4xl">
                {}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                    <div className="flex overflow-x-auto">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap
                                    ${activeSection === section.id
                                        ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <section.icon className="w-4 h-4" />
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* General Settings */}
                {activeSection === "general" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">General Settings</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure basic platform settings</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform Name</label>
                                <input
                                    type="text"
                                    value={settings.platformName}
                                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform Description</label>
                                <textarea
                                    value={settings.platformDescription}
                                    onChange={(e) => setSettings({ ...settings, platformDescription: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
                                />
                            </div>
                            <ToggleRow
                                label="Maintenance Mode"
                                description="Temporarily disable access for non-admin users. Students and teachers will see a maintenance page."
                                enabled={settings.maintenanceMode}
                                onChange={(v) => setSettings({ ...settings, maintenanceMode: v })}
                            />
                            {settings.maintenanceMode && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <span className="text-amber-600 dark:text-amber-400 text-lg leading-none">⚠</span>
                                    <p className="text-sm text-amber-800 dark:text-amber-300">
                                        Maintenance mode is <strong>ON</strong>. All non-admin users will be blocked from accessing the platform. Remember to click <strong>Save Changes</strong> to apply.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeSection === "database" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Database</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Backup and data retention settings</p>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Backup Frequency</label>
                                <select value={settings.backupFrequency} onChange={(e) => setSettings({ ...settings, backupFrequency: e.target.value })}
                                    className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white">
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Data Retention (days)</label>
                                <input type="number" value={settings.retentionDays} min={7} max={365}
                                    onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
                                    className="w-32 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" />
                            </div>
                            <div className="py-4 px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Database className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">MongoDB Atlas</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Connected to your cloud database</p>
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Connected
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function ToggleRow({ label, description, enabled, onChange, last = false }) {
    return (
        <div className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-gray-100 dark:border-gray-700"}`}>
            <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            </div>
            <button
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full transition-transform ${enabled ? 'translate-x-6 bg-white dark:bg-gray-900' : 'translate-x-1 bg-white'}`} />
            </button>
        </div>
    );
}


import React, { useState, useEffect } from "react";
import useUserStore from "../stores/userStore";
import AdminLayout from "../components/AdminLayout";
import {
    Settings, Database, Globe,
    Save, Check, Loader2, Stamp
} from "lucide-react";
import authFetch from "../utils/authFetch";
import { SettingsPageSkeleton } from "../components/LoadingSpinner";

import { useToast } from "../contexts/ToastContext";
const API_URL = import.meta.env.VITE_API_URL;

const DEFAULT_WATERMARK = {
    enabled: false,
    primaryText: "",
    secondaryText: "",
    primaryLogoUrl: "",
    secondaryLogoUrl: "",
};

const DEFAULT_SETTINGS = {
    platformName: "NCERT Learning Platform",
    platformDescription: "Interactive learning platform for NCERT curriculum",
    maintenanceMode: false,
    backupFrequency: "daily",
    retentionDays: 30,
    questionTypes: ["mcq", "fillup", "true_false", "short_answer", "long_answer"],
    cognitiveLevels: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
    difficultyLevels: ["easy", "medium", "hard"],
    watermark: DEFAULT_WATERMARK,
};

const normalizeOptionValue = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");

const normalizeOptionList = (values, fallback) => {
    if (!Array.isArray(values)) return fallback;
    const cleaned = [];
    values.forEach((value) => {
        const normalized = normalizeOptionValue(value);
        if (!normalized) return;
        if (!cleaned.includes(normalized)) cleaned.push(normalized);
    });
    return cleaned.length > 0 ? cleaned : fallback;
};

const sanitizeSettings = (raw = {}) => {
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    const mergedWatermark = { ...DEFAULT_WATERMARK, ...(merged.watermark || {}) };
    return {
        ...merged,
        questionTypes: normalizeOptionList(merged.questionTypes, DEFAULT_SETTINGS.questionTypes),
        cognitiveLevels: normalizeOptionList(merged.cognitiveLevels, DEFAULT_SETTINGS.cognitiveLevels),
        difficultyLevels: normalizeOptionList(merged.difficultyLevels, DEFAULT_SETTINGS.difficultyLevels),
        watermark: {
            enabled: Boolean(mergedWatermark.enabled),
            primaryText: String(mergedWatermark.primaryText || "").trim(),
            secondaryText: String(mergedWatermark.secondaryText || "").trim(),
            primaryLogoUrl: String(mergedWatermark.primaryLogoUrl || "").trim(),
            secondaryLogoUrl: String(mergedWatermark.secondaryLogoUrl || "").trim(),
        },
    };
};

export default function AdminSettings() {
  const { toast } = useToast();
    const { user, getAuthHeader } = useUserStore();
    const [activeSection, setActiveSection] = useState("general_settings");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [newQuestionType, setNewQuestionType] = useState("");
    const [newCognitiveLevel, setNewCognitiveLevel] = useState("");
    const [newDifficultyLevel, setNewDifficultyLevel] = useState("");

    const persistSettings = async (nextSettings) => {
        const payload = sanitizeSettings(nextSettings);
        const res = await authFetch(`${API_URL}/api/admin/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || "Failed to save settings.");
        }
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to save settings.");
        }
        setSettings(payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const addOption = async (field, value, clear) => {
        const normalized = normalizeOptionValue(value);
        if (!normalized) return;
        const existing = Array.isArray(settings[field]) ? settings[field] : [];
        if (existing.includes(normalized)) {
            clear("");
            return;
        }

        const nextSettings = {
            ...settings,
            [field]: [...existing, normalized]
        };
        setSettings(nextSettings);
        clear("");
        await persistSettings(nextSettings);
    };

    const removeOption = async (field, option) => {
        const nextSettings = {
            ...settings,
            [field]: (Array.isArray(settings[field]) ? settings[field] : []).filter(v => v !== option)
        };
        setSettings(nextSettings);
        await persistSettings(nextSettings);
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await authFetch(`${API_URL}/api/admin/settings`, {
                    headers: getAuthHeader()
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings(sanitizeSettings(data));
                }
            } catch (err) {
                setLoadError("Failed to load settings.");
            } finally {
                setInitializing(false);
            }
        };
        fetchSettings();
    }, []);

    if (initializing) {
        return (
            <AdminLayout title="Settings" icon={Settings}>
                <SettingsPageSkeleton />
            </AdminLayout>
        );
    }

    const handleSave = async () => {
        setSaving(true);
        try {
            await persistSettings(settings);
        } catch (err) {
            toast.error(err.message || "Network error saving settings.")
        } finally {
            setSaving(false);
        }
    };

    const sections = [
        { id: "general_settings", label: "General Settings", icon: Globe },
        { id: "question_options", label: "Question Dropdown Option", icon: Settings },
        { id: "watermark", label: "Watermark", icon: Stamp },
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

                {activeSection === "general_settings" && (
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

                {activeSection === "question_options" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Question Dropdown Option</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Manage all dropdown values used while creating and evaluating questions</p>
                        <div className="space-y-2">
                            <OptionEditor
                                title="Question Types"
                                values={settings.questionTypes || []}
                                inputValue={newQuestionType}
                                setInputValue={setNewQuestionType}
                                onAdd={() => addOption("questionTypes", newQuestionType, setNewQuestionType).catch((err) => toast.error(err.message || "Failed to save settings."))}
                                onRemove={(v) => removeOption("questionTypes", v).catch((err) => toast.error(err.message || "Failed to save settings."))}
                            />

                            <OptionEditor
                                title="Cognitive Levels"
                                values={settings.cognitiveLevels || []}
                                inputValue={newCognitiveLevel}
                                setInputValue={setNewCognitiveLevel}
                                onAdd={() => addOption("cognitiveLevels", newCognitiveLevel, setNewCognitiveLevel).catch((err) => toast.error(err.message || "Failed to save settings."))}
                                onRemove={(v) => removeOption("cognitiveLevels", v).catch((err) => toast.error(err.message || "Failed to save settings."))}
                            />

                            <OptionEditor
                                title="Difficulty Levels"
                                values={settings.difficultyLevels || []}
                                inputValue={newDifficultyLevel}
                                setInputValue={setNewDifficultyLevel}
                                onAdd={() => addOption("difficultyLevels", newDifficultyLevel, setNewDifficultyLevel).catch((err) => toast.error(err.message || "Failed to save settings."))}
                                onRemove={(v) => removeOption("difficultyLevels", v).catch((err) => toast.error(err.message || "Failed to save settings."))}
                            />
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

                {activeSection === "watermark" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Global Watermark</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Configure two watermark blocks shown across admin, teacher, head, and student dashboards</p>

                        <div className="space-y-5">
                            <ToggleRow
                                label="Enable Watermark"
                                description="Show watermark text/logo blocks in the app footer for all logged-in roles."
                                enabled={settings.watermark?.enabled}
                                onChange={(v) => setSettings({
                                    ...settings,
                                    watermark: { ...(settings.watermark || DEFAULT_WATERMARK), enabled: v }
                                })}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Primary Block</h3>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Primary Text</label>
                                        <input
                                            type="text"
                                            value={settings.watermark?.primaryText || ""}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                watermark: { ...(settings.watermark || DEFAULT_WATERMARK), primaryText: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Primary Logo URL</label>
                                        <input
                                            type="url"
                                            value={settings.watermark?.primaryLogoUrl || ""}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                watermark: { ...(settings.watermark || DEFAULT_WATERMARK), primaryLogoUrl: e.target.value }
                                            })}
                                            placeholder="https://example.com/logo.png"
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Secondary Block</h3>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Secondary Text</label>
                                        <input
                                            type="text"
                                            value={settings.watermark?.secondaryText || ""}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                watermark: { ...(settings.watermark || DEFAULT_WATERMARK), secondaryText: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Secondary Logo URL</label>
                                        <input
                                            type="url"
                                            value={settings.watermark?.secondaryLogoUrl || ""}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                watermark: { ...(settings.watermark || DEFAULT_WATERMARK), secondaryLogoUrl: e.target.value }
                                            })}
                                            placeholder="https://example.com/logo.png"
                                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                        />
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

function OptionEditor({ title, values, inputValue, setInputValue, onAdd, onRemove }) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{title}</label>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Add option (e.g. case_study)"
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
                <button
                    type="button"
                    onClick={onAdd}
                    className="px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium"
                >
                    Add
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {values.map((v) => (
                    <span key={v} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                        {v}
                        <button type="button" onClick={() => onRemove(v)} className="text-gray-400 hover:text-red-500">×</button>
                    </span>
                ))}
                {values.length === 0 && <span className="text-xs text-gray-400">No options added</span>}
            </div>
        </div>
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

"use client";

import { useTranslation } from "@/lib/i18n";
import { Globe } from "lucide-react";

export default function LanguageToggle() {
    const { language, setLanguage } = useTranslation();

    return (
        <button
            onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={language === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
        >
            <Globe size={14} className="text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
                {language === "vi" ? "VI" : "EN"}
            </span>
        </button>
    );
}

"use client";

import { useState, ReactNode } from "react";
import { Check, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";

export interface WizardStep {
    id: number;
    label: string;
    icon: React.ElementType;
    description?: string;
}

interface TransactionWizardProps {
    steps: WizardStep[];
    currentStep: number;
    children: ReactNode;
    colorScheme?: "green" | "red" | "blue";
}

const colorClasses = {
    green: {
        active: "bg-green-500/20 text-green-400",
        completed: "bg-green-500 text-white",
        icon: "bg-green-500/20 text-green-400",
        iconCompleted: "bg-green-500 text-white",
        progress: "bg-green-500",
    },
    red: {
        active: "bg-red-500/20 text-red-400",
        completed: "bg-green-500 text-white",
        icon: "bg-red-500/20 text-red-400",
        iconCompleted: "bg-green-500 text-white",
        progress: "bg-red-500",
    },
    blue: {
        active: "bg-blue-500/20 text-blue-400",
        completed: "bg-green-500 text-white",
        icon: "bg-blue-500/20 text-blue-400",
        iconCompleted: "bg-green-500 text-white",
        progress: "bg-blue-500",
    },
};

export function WizardProgress({ steps, currentStep, colorScheme = "green" }: Omit<TransactionWizardProps, "children">) {
    const colors = colorClasses[colorScheme];
    const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div className="relative">
            {/* Progress bar background */}
            <div className="absolute top-5 left-0 right-0 h-1 bg-white/10 rounded-full mx-12" />
            {/* Progress bar fill */}
            <div 
                className={`absolute top-5 left-0 h-1 ${colors.progress} rounded-full mx-12 transition-all duration-500`}
                style={{ width: `calc(${progressPercent}% - 6rem)` }}
            />
            
            <div className="relative flex justify-between">
                {steps.map((step, idx) => {
                    const isCompleted = currentStep > step.id;
                    const isActive = currentStep === step.id;
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="flex flex-col items-center">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                    isCompleted
                                        ? colors.iconCompleted
                                        : isActive
                                        ? colors.icon
                                        : "bg-white/10 text-white/30"
                                }`}
                            >
                                {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                            </div>
                            <span className={`mt-2 text-xs font-medium transition-colors ${
                                isActive ? "text-white" : isCompleted ? "text-white/70" : "text-white/30"
                            }`}>
                                {step.label}
                            </span>
                            {step.description && (
                                <span className="text-[10px] text-white/40 mt-0.5">{step.description}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface WizardStepPanelProps {
    title: string;
    description?: string;
    icon: React.ElementType;
    isCompleted?: boolean;
    isActive?: boolean;
    colorScheme?: "green" | "red" | "blue";
    children: ReactNode;
    summary?: ReactNode;
    onNext?: () => void;
    onBack?: () => void;
    showBack?: boolean;
    nextLabel?: string;
    nextDisabled?: boolean;
    isLastStep?: boolean;
    onEdit?: () => void;
}

export function WizardStepPanel({
    title,
    description,
    icon: Icon,
    isCompleted,
    isActive,
    colorScheme = "green",
    children,
    summary,
    onNext,
    onBack,
    showBack,
    nextLabel = "Tiếp tục",
    nextDisabled,
    isLastStep,
    onEdit,
}: WizardStepPanelProps) {
    const colors = colorClasses[colorScheme];

    if (!isActive && !isCompleted) return null;

    // Completed step - compact view
    if (isCompleted && !isActive) {
        return (
            <div 
                className="p-3 rounded-xl bg-green-500/5 border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-all group"
                onClick={onEdit}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                        <Check size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/40">{title}</span>
                        <div className="text-sm text-white font-medium truncate">
                            {summary}
                        </div>
                    </div>
                    <button 
                        type="button"
                        className="text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        Sửa
                    </button>
                </div>
            </div>
        );
    }

    // Active step - full view
    return (
        <div className="p-5 rounded-2xl border bg-white/5 border-white/10 transition-all duration-300">
            {/* Header with back button */}
            <div className="flex items-center gap-3 mb-4">
                {showBack && onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all"
                        title="Quay lại"
                    >
                        <ChevronLeft size={18} />
                    </button>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.icon}`}>
                    <Icon size={20} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-white">{title}</h3>
                    {description && <p className="text-xs text-white/40">{description}</p>}
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {children}
                
                {onNext && !isLastStep && (
                    <div className="flex justify-end mt-4 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onNext}
                            disabled={nextDisabled}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                colorScheme === "green"
                                    ? "bg-green-500 hover:bg-green-400 text-white"
                                    : colorScheme === "red"
                                    ? "bg-red-500 hover:bg-red-400 text-white"
                                    : "bg-blue-500 hover:bg-blue-400 text-white"
                            }`}
                        >
                            {nextLabel}
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function WizardSummaryItem({ label, value, icon }: { label: string; value: string; icon?: string }) {
    return (
        <div className="flex items-center gap-2">
            {icon && <span>{icon}</span>}
            <span className="text-white/50">{label}:</span>
            <span className="text-white font-medium">{value}</span>
        </div>
    );
}

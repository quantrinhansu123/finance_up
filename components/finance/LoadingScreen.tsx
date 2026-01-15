"use client";

import { motion } from "framer-motion";

export default function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#05050a] overflow-hidden">
            {/* Background Tech Elements */}
            <div className="absolute inset-0 bg-grid-white opacity-10 pointer-events-none" />
            <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />

            {/* Central Tech Rings */}
            <div className="relative flex items-center justify-center">
                {/* Outer Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-64 h-64 rounded-full border border-blue-500/20 border-t-blue-500/60 border-l-blue-500/40 relative shadow-[0_0_50px_-15px_rgba(59,130,246,0.3)]"
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_#60a5fa]" />
                </motion.div>

                {/* Middle Ring (Reverse) */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                    className="absolute w-48 h-48 rounded-full border border-purple-500/20 border-b-purple-500/60 border-r-purple-500/40"
                >
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_10px_#a855f7]" />
                </motion.div>

                {/* Inner Tech Circle */}
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-inner"
                >
                    <div className="text-blue-400 font-bold text-xl tracking-widest animate-pulse">UP</div>
                </motion.div>

                {/* Scanning Line */}
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="w-full h-1 bg-blue-500/30 shadow-[0_0_20px_#3b82f6] animate-scanning" />
                </div>
            </div>

            {/* Loading Text & Status */}
            <div className="mt-12 text-center space-y-3">
                <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-white/80 font-mono text-sm tracking-[0.3em] uppercase"
                >
                    Initializating System
                </motion.h2>

                <div className="flex items-center gap-2 justify-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <div className="h-[1px] w-32 bg-white/10 relative overflow-hidden">
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                        />
                    </div>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-75" />
                </div>

                <div className="text-[10px] text-blue-400/40 font-mono space-y-1">
                    <p>CORE_MODULE_PROJECTS: OK</p>
                    <p>USER_AUTH_SESSION: SYNCING...</p>
                </div>
            </div>

            {/* corner tech accents */}
            <div className="absolute top-10 left-10 w-20 h-20 border-t border-l border-white/10" />
            <div className="absolute top-10 right-10 w-20 h-20 border-t border-r border-white/10" />
            <div className="absolute bottom-10 left-10 w-20 h-20 border-b border-l border-white/10" />
            <div className="absolute bottom-10 right-10 w-20 h-20 border-b border-r border-white/10" />
        </div>
    );
}

import { Account } from "@/types/finance";

interface AccountCardProps {
    account: Account;
}

export default function AccountCard({ account }: AccountCardProps) {
    const isPositive = account.balance >= 0;

    // Gradient definitions based on currency or random for visual distinction
    const getGradient = (currency: string) => {
        switch (currency) {
            case "USD": return "from-[#1e3c72] to-[#2a5298]"; // Blue
            case "VND": return "from-[#c31432] to-[#240b36]"; // Red/Purple
            case "KHR": return "from-[#11998e] to-[#38ef7d]"; // Green
            default: return "from-gray-700 to-gray-900";
        }
    };

    return (
        <div className={`relative w-full h-56 rounded-2xl bg-gradient-to-br ${getGradient(account.currency)} p-6 text-white shadow-xl transition-transform hover:scale-[1.02] overflow-hidden group`}>
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors"></div>
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-black/10 blur-3xl"></div>

            <div className="flex flex-col justify-between h-full relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-white/70 text-sm font-medium tracking-wider mb-1">Current Balance</p>
                        <h3 className="text-3xl font-bold tracking-tight">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.balance)}
                        </h3>
                    </div>
                    {/* Chip Icon */}
                    <div className="w-12 h-9 rounded-md bg-white/20 border border-white/30 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent"></div>
                        <div className="w-full h-[1px] bg-black/20 mb-[2px]"></div>
                        <div className="w-full h-[1px] bg-black/20 mt-[2px]"></div>
                        <div className="h-full w-[1px] bg-black/20 ml-[2px]"></div>
                        <div className="h-full w-[1px] bg-black/20 mr-[2px]"></div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Card Holder</p>
                            <p className="font-medium truncate">{account.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Expires</p>
                            <p className="font-medium">12/28</p> {/* Mock date */}
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 text-lg font-mono tracking-widest opacity-90">
                            <span>****</span> <span>****</span> <span>****</span> <span>{account.id.slice(0, 4)}</span>
                        </div>
                        {/* Visa/Mastercard Logo Simulation */}
                        <div className="flex -space-x-3 opacity-90">
                            <div className="w-8 h-8 rounded-full bg-red-500/80"></div>
                            <div className="w-8 h-8 rounded-full bg-yellow-500/80"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

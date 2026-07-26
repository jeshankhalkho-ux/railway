import React, { useState, useEffect } from "react";
import { Search, Train, Calendar, AlertCircle, ChevronDown, ChevronUp, MapPin, Sun, Moon, Clock, Printer, X, Map, Coffee, Info, ShieldCheck, Navigation } from "lucide-react";
import { format } from "date-fns";
import { TrainStatusResponse, TrainScheduleResponse, TrainsBetweenResponse, RecentSearch } from "./types";
import { motion, AnimatePresence } from "motion/react";

const INTERNAL_TOKEN = "RailSafe-Secured-Token-2024";

type Tab = 'live_status' | 'train_schedule' | 'trains_between';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<Tab>('live_status');
  
  const [trainNumber, setTrainNumber] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const [scheduleTrainNumber, setScheduleTrainNumber] = useState("");
  const [fromStation, setFromStation] = useState("");
  const [toStation, setToStation] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [statusData, setStatusData] = useState<TrainStatusResponse["data"] | null>(null);
  const [scheduleData, setScheduleData] = useState<TrainScheduleResponse["data"] | null>(null);
  const [trainsBetweenData, setTrainsBetweenData] = useState<TrainsBetweenResponse["data"] | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [selectedMapStation, setSelectedMapStation] = useState<{name: string, code: string} | null>(null);

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const addRecentSearch = (search: Omit<RecentSearch, 'id' | 'timestamp'>) => {
    setRecentSearches(prev => {
      const newSearch: RecentSearch = {
        ...search,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now()
      };
      
      const filtered = prev.filter(s => 
        !(s.type === search.type && 
          s.trainNumber === search.trainNumber && 
          s.date === search.date && 
          s.fromStation === search.fromStation && 
          s.toStation === search.toStation)
      );
      
      const updated = [newSearch, ...filtered].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRecentSearchClick = (search: RecentSearch) => {
    setActiveTab(search.type);
    if (search.type === 'live_status') {
      setTrainNumber(search.trainNumber || '');
      setDate(search.date || format(new Date(), "yyyy-MM-dd"));
    } else if (search.type === 'train_schedule') {
      setScheduleTrainNumber(search.trainNumber || '');
    } else if (search.type === 'trains_between') {
      setFromStation(search.fromStation || '');
      setToStation(search.toStation || '');
      setDate(search.date || format(new Date(), "yyyy-MM-dd"));
    }
    if (window.innerWidth < 1024) setIsSearchOpen(true);
  };

  const fetchStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainNumber) return;
    
    setLoading(true);
    setError(null);
    setStatusData(null);
    setShowIntro(false);

    try {
      const response = await fetch(`/api/railway/train/status?number=${trainNumber}&date=${date}`, {
        headers: { "x-internal-token": INTERNAL_TOKEN }
      });
      
      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded.");
        throw new Error("Failed to fetch train status.");
      }

      const data: TrainStatusResponse = await response.json();
      if (data.success && data.data) {
        setStatusData(data.data);
        addRecentSearch({ type: 'live_status', trainNumber, date });
        if (window.innerWidth < 1024) setIsSearchOpen(false);
      } else throw new Error("Train not found.");
    } catch (err: any) { setError(err.message || "Error occurred."); } 
    finally { setLoading(false); }
  };

  const fetchSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTrainNumber) return;
    setLoading(true); setError(null); setScheduleData(null);
    setShowIntro(false);
    try {
      const response = await fetch(`/api/railway/train/route?number=${scheduleTrainNumber}`, { headers: { "x-internal-token": INTERNAL_TOKEN } });
      if (!response.ok) throw new Error("Failed to fetch schedule.");
      const data: TrainScheduleResponse = await response.json();
      if (data.success && data.data) { 
        setScheduleData(data.data); 
        addRecentSearch({ type: 'train_schedule', trainNumber: scheduleTrainNumber });
        if (window.innerWidth < 1024) setIsSearchOpen(false); 
      }
      else throw new Error("Train not found.");
    } catch (err: any) { setError(err.message || "Error occurred."); } 
    finally { setLoading(false); }
  };

  const fetchTrainsBetween = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStation || !toStation) return;
    setLoading(true); setError(null); setTrainsBetweenData(null);
    setShowIntro(false);
    try {
      const response = await fetch(`/api/railway/trains/between?from=${fromStation}&to=${toStation}&date=${date}`, { headers: { "x-internal-token": INTERNAL_TOKEN } });
      if (!response.ok) throw new Error("Failed to fetch trains.");
      const data: TrainsBetweenResponse = await response.json();
      if (data.success && data.data) { 
        setTrainsBetweenData(data.data); 
        addRecentSearch({ type: 'trains_between', fromStation, toStation, date });
        if (window.innerWidth < 1024) setIsSearchOpen(false); 
      }
      else throw new Error("No trains found.");
    } catch (err: any) { setError(err.message || "Error occurred."); } 
    finally { setLoading(false); }
  };

  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#080d19] text-slate-900 dark:text-white transition-colors relative overflow-hidden font-sans selection:bg-blue-200 dark:selection:bg-blue-900/50">
        
        {/* Top Government Bar */}
        <div className="w-full bg-[#002147] text-white py-1.5 px-4 sm:px-6 lg:px-8 text-xs font-medium tracking-wide flex justify-between items-center z-50 shadow-md border-b border-blue-900/50">
          <div className="flex items-center gap-4 opacity-90">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              Official Government Portal
            </span>
            <span className="hidden sm:inline-block border-l border-white/20 pl-4">
              Ministry of Railways
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="hover:text-blue-200 transition-colors hidden sm:block">A- | A | A+</button>
            <div className="w-px h-3 bg-white/20 hidden sm:block"></div>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="hover:text-blue-200 transition-colors flex items-center gap-1.5"
              title="Toggle Contrast"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">High Contrast</span>
            </button>
          </div>
        </div>

        {/* Decorative Grid Background */}
        <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        
        {/* Abstract Blue Accent */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none z-0"></div>

        {/* Main Content Area */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center mb-8"
          >
            <div className="w-20 h-20 bg-blue-900 dark:bg-blue-800 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-6 border border-blue-800/50 relative overflow-hidden group">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              />
              <Train className="w-10 h-10 text-white relative z-10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-blue-900 dark:text-blue-400 font-bold uppercase tracking-[0.2em] text-xs sm:text-sm">
                National Railway Enquiry System
              </h2>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                RailTrack <span className="text-blue-600 dark:text-blue-500 font-bold not-italic no-underline text-center font-sans">Portal</span>
              </h1>
            </div>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-base md:text-lg text-slate-600 dark:text-slate-400 mb-12 text-center max-w-2xl font-medium leading-relaxed"
          >
            Access real-time train status, comprehensive schedules, and seamless route planning through the official national railway network interface.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <button
              onClick={() => setShowIntro(false)}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-base py-3.5 px-8 rounded-lg transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-3 w-full sm:w-auto border border-blue-600 dark:border-blue-500"
            >
              <Search className="w-5 h-5" />
              Access Railway Services
            </button>
          </motion.div>
          
          {/* Service Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl"
          >
            {[
              { icon: MapPin, title: "Live Status", desc: "Track current location and delays" },
              { icon: Calendar, title: "Schedules", desc: "View detailed station timings" },
              { icon: Navigation, title: "Route Plan", desc: "Find trains between stations" }
            ].map((feature, i) => (
              <div key={i} className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-6 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </motion.div>

        </div>
        
        {/* Footer */}
        <footer className="w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 z-10 relative mt-auto">
          <p>© {new Date().getFullYear()} Ministry of Railways. All rights reserved.</p>
          <div className="mt-2 flex justify-center gap-4">
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Accessibility Statement</a>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col bg-slate-50 text-slate-900 dark:bg-[#080d19] dark:text-slate-50 transition-colors selection:bg-blue-200 dark:selection:bg-blue-900/50`}>
      {/* Top Government Bar */}
      <div className="w-full bg-[#002147] text-white py-1.5 px-4 sm:px-6 lg:px-8 text-xs font-medium tracking-wide flex justify-between items-center z-[60] shadow-md border-b border-blue-900/50 print:hidden">
        <div className="flex items-center gap-4 opacity-90">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            Official Government Portal
          </span>
          <span className="hidden sm:inline-block border-l border-white/20 pl-4">
            Ministry of Railways
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="hover:text-blue-200 transition-colors hidden sm:block">A- | A | A+</button>
          <div className="w-px h-3 bg-white/20 hidden sm:block"></div>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="hover:text-blue-200 transition-colors flex items-center gap-1.5"
            title="Toggle Contrast"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">High Contrast</span>
          </button>
        </div>
      </div>

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors print:hidden shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowIntro(true)}>
            <div className="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-blue-600">
              <Train className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">RailTrack<span className="text-blue-600 dark:text-blue-500 font-bold ml-0.5">Portal</span></span>
          </div>
          
          <nav className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
            {[
              { id: 'live_status', label: 'Live Status' },
              { id: 'train_schedule', label: 'Schedule' },
              { id: 'trains_between', label: 'Trains Between' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  activeTab === tab.id 
                    ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50" 
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/30"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border border-blue-200/50 dark:border-blue-500/20">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              System Secure
            </div>
          </div>
        </div>
        {/* Mobile Tabs */}
        <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-200 dark:border-slate-800 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] print:hidden">
          {[
            { id: 'live_status', label: 'Live Status' },
            { id: 'train_schedule', label: 'Schedule' },
            { id: 'trains_between', label: 'Trains Between' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-full border transition-colors ${
                activeTab === tab.id 
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30" 
                  : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 print:py-0">
        
        {/* Search Command Center */}
        <section className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-stretch overflow-hidden relative print:hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex-1 w-full relative z-10 flex flex-col justify-center">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              {activeTab === 'live_status' ? 'Track Live Status' : activeTab === 'train_schedule' ? 'Check Schedule' : 'Find Trains'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm md:text-base">
              {activeTab === 'live_status' ? 'Enter a train number and date to get real-time running information.' : 
               activeTab === 'train_schedule' ? 'Enter a train number to view its complete route and station timings.' : 
               'Enter origin and destination station codes to find available train options.'}
            </p>

            {activeTab === 'live_status' && (
              <form onSubmit={fetchStatus} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Train Number (e.g. 12050)"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="relative sm:w-48">
                  <Calendar className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-blue-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap"
                >
                  {loading ? "Searching..." : "Track Train"}
                </button>
              </form>
            )}

            {activeTab === 'train_schedule' && (
              <form onSubmit={fetchSchedule} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Train Number (e.g. 12050)"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={scheduleTrainNumber}
                    onChange={(e) => setScheduleTrainNumber(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-blue-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap"
                >
                  {loading ? "Searching..." : "View Schedule"}
                </button>
              </form>
            )}

            {activeTab === 'trains_between' && (
              <form onSubmit={fetchTrainsBetween} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MapPin className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Origin Code"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={fromStation}
                    onChange={(e) => setFromStation(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="relative flex-1">
                  <MapPin className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Dest Code"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={toStation}
                    onChange={(e) => setToStation(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="relative sm:w-40">
                  <Calendar className="absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-slate-500 transition-all shadow-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-blue-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm whitespace-nowrap"
                >
                  {loading ? "Searching..." : "Find"}
                </button>
              </form>
            )}

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3.5 flex items-start gap-3 transition-colors">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Recent Searches Side Panel */}
          {recentSearches.length > 0 && (
            <div className="w-full lg:w-72 lg:pl-8 lg:border-l border-slate-200 dark:border-slate-700 relative z-10 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recent Lookups</h3>
              </div>
              <div className="flex flex-col gap-2">
                {recentSearches.map(search => (
                  <button
                    key={search.id}
                    onClick={() => handleRecentSearchClick(search)}
                    className="text-left p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-500/30 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all group flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        {search.type === 'live_status' ? `Live Status: ${search.trainNumber}` : 
                         search.type === 'train_schedule' ? `Schedule: ${search.trainNumber}` : 
                         `${search.fromStation} → ${search.toStation}`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {search.type === 'trains_between' || search.type === 'live_status' ? (search.date ? format(new Date(search.date), "dd MMM yyyy") : '') : 'Full Schedule'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Results Data Section */}
        <section className="flex-1 pb-12 print:pb-0">
          {!statusData && activeTab === 'live_status' && (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px] print:hidden">
              <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <Train className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Track Your Train</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">Enter your train number and date to get real-time running status, delays, and expected arrival times across the network.</p>
            </div>
          )}

          {!scheduleData && activeTab === 'train_schedule' && (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px] print:hidden">
              <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <Search className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Check Train Schedule</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">Enter any valid train number to view its complete schedule, halts, timings, and platform information.</p>
            </div>
          )}

          {!trainsBetweenData && activeTab === 'trains_between' && (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px] print:hidden">
              <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Find Available Trains</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">Enter the origin and destination stations to explore trains running between them and their availability.</p>
            </div>
          )}

          {activeTab === 'live_status' && statusData && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md text-xs font-bold font-mono border border-blue-200 dark:border-blue-500/30">
                      {statusData.trainNumber}
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                      {statusData.trainName}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
                    <span>{statusData.train.source.name}</span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span>{statusData.train.destination.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-w-[200px]">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Status</div>
                    <div className={`text-lg font-bold ${statusData.status === 'completed' ? 'text-blue-600 dark:text-blue-400' : statusData.status === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                      {statusData.status === "not-started" ? "Not Started" : statusData.status === "running" ? "On Time" : statusData.status === "completed" ? "Completed" : "Unknown"}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Journey: {statusData.startDate}</div>
                  </div>
                  <button onClick={() => window.print()} className="print:hidden h-full flex flex-col items-center justify-center px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400">
                    <Printer className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Print</span>
                  </button>
                </div>
              </div>

              {/* Timeline Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Route Timeline</h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md shadow-sm">
                    {statusData.route?.filter(s => s.isHalt).length || 0} Halts
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4 font-semibold tracking-wider">Station</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Scheduled</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Actual</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                        <th className="px-6 py-4 font-semibold tracking-wider">Dist.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {(statusData.route || []).filter(s => s.isHalt).map((station, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => setSelectedMapStation({ name: station.stationName, code: station.stationCode })}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{station.stationName}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{station.stationCode}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
                            {station.scheduledArrival ? format(new Date(station.scheduledArrival), "HH:mm, dd MMM") : "-"}
                          </td>
                          <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-bold">
                            {station.actualArrival ? format(new Date(station.actualArrival), "HH:mm, dd MMM") : "-"}
                          </td>
                          <td className="px-6 py-4">
                            {station.delayArrival !== undefined ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                                station.delayArrival > 0 
                                  ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-500/20' 
                                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20'
                              }`}>
                                {station.delayArrival > 0 ? `${station.delayArrival}m late` : 'On Time'}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                            {station.distance} km
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'train_schedule' && scheduleData && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Train Route Schedule</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Complete listing of all stops and timings.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Stations: </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white ml-1">{scheduleData.stations?.length || 0}</span>
                  </div>
                  <button onClick={() => window.print()} className="print:hidden p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-colors text-slate-500 dark:text-slate-400" title="Print Schedule">
                    <Printer className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 font-semibold tracking-wider">#</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Station</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Arrival</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Departure</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Dist.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {(scheduleData.stations || []).map((station, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedMapStation({ name: station.station, code: station.station })}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono text-xs">{station.seq}</td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{station.station}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{station.arrival || "Start"}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{station.departure || "End"}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{station.distance} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'trains_between' && trainsBetweenData && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Available Trains</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Found {trainsBetweenData.count} trains matching your criteria.</p>
                </div>
                <button onClick={() => window.print()} className="print:hidden p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-colors text-slate-500 dark:text-slate-400 shadow-sm" title="Print Results">
                  <Printer className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1 print:gap-4 print:break-inside-avoid">
                {(trainsBetweenData.trains || []).map((trainObj, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500/50 transition-all print:break-inside-avoid print:shadow-none print:border-slate-300">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[11px] font-bold font-mono border border-blue-200 dark:border-blue-500/30">
                            {trainObj.train.number}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {trainObj.train.type}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{trainObj.train.name}</h3>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                          {Math.floor(trainObj.duration / 60)}h {trainObj.duration % 60}m
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">{trainObj.distance} km</span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      {/* Visual connection line */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-px bg-slate-200 dark:bg-slate-700 border-t border-dashed border-slate-300 dark:border-slate-600"></div>
                      
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-100 dark:border-slate-800 relative z-10">
                        <div className="text-left bg-slate-50 dark:bg-[#111827] px-2">
                          <div className="text-xl font-black text-slate-900 dark:text-white mb-0.5">{trainObj.from.departure}</div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]" title={trainObj.from.name}>
                            {trainObj.from.name} <span className="font-mono text-[10px]">({trainObj.from.code})</span>
                          </div>
                        </div>
                        
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm z-10">
                          <Train className="w-4 h-4" />
                        </div>
                        
                        <div className="text-right bg-slate-50 dark:bg-[#111827] px-2">
                          <div className="text-xl font-black text-slate-900 dark:text-white mb-0.5">{trainObj.to.arrival}</div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]" title={trainObj.to.name}>
                            {trainObj.to.name} <span className="font-mono text-[10px]">({trainObj.to.code})</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

      </main>

      <AnimatePresence>
        {selectedMapStation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMapStation(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Map className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedMapStation.name}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">{selectedMapStation.code}</span>
                      <span>Station Map & Amenities</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMapStation(null)}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-1 mb-6">
                  {/* Schematic Map Placeholder */}
                  <div className="relative w-full aspect-[2/1] bg-slate-200/50 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
                    {/* Platform Lines */}
                    <div className="absolute inset-0 flex flex-col justify-evenly py-6 opacity-30">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-full h-2 bg-slate-400 dark:bg-slate-600 relative">
                          <div className="absolute left-4 -top-4 text-[10px] font-bold text-slate-600 dark:text-slate-400">PF {i}</div>
                        </div>
                      ))}
                    </div>
                    {/* Station Building Outline */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 w-24 h-3/4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-md shadow-sm flex items-center justify-center z-10">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 rotate-90 tracking-widest uppercase">Terminal</span>
                    </div>
                    {/* Connectors */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-6 bg-yellow-100 dark:bg-yellow-900/30 border-x border-yellow-300 dark:border-yellow-700/50 z-10 flex flex-col justify-between py-2">
                       <span className="text-[8px] text-center font-bold text-yellow-700 dark:text-yellow-500">BRIDGE</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Nearby Amenities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { icon: Coffee, label: "Cafeteria", desc: "Platform 1" },
                    { icon: Info, label: "Enquiry", desc: "Main Concourse" },
                    { icon: ShieldCheck, label: "Police", desc: "Platform 2" },
                    { icon: MapPin, label: "Taxi Stand", desc: "Exit A" }
                  ].map((amenity, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <amenity.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-200">{amenity.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{amenity.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white dark:bg-[#0B1120] py-6 border-t border-slate-200 dark:border-slate-800 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Systems Operational
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              End-to-End Encryption Enabled
            </div>
          </div>
          <div>© {new Date().getFullYear()} RailTrack Pro Enterprise. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

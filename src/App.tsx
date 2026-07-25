import React, { useState, useEffect } from "react";
import { Search, Train, Calendar, AlertCircle, ChevronDown, ChevronUp, MapPin, Sun, Moon, Clock } from "lucide-react";
import { format } from "date-fns";
import { TrainStatusResponse, TrainScheduleResponse, TrainsBetweenResponse, RecentSearch } from "./types";

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

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

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

  return (
    <div className={`h-screen font-sans flex flex-col overflow-hidden transition-colors ${theme === 'dark' ? 'dark bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 transition-colors">
        <div className="px-4 md:px-8 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Train className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">RailTrack Pro</span>
          </div>
          <nav className="hidden md:flex space-x-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <button onClick={() => setActiveTab('live_status')} className={activeTab === 'live_status' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors pb-1"}>Live Status</button>
            <button onClick={() => setActiveTab('train_schedule')} className={activeTab === 'train_schedule' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors pb-1"}>Train Schedule</button>
            <button onClick={() => setActiveTab('trains_between')} className={activeTab === 'trains_between' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 pb-1" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors pb-1"}>Trains Between</button>
          </nav>
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden sm:flex items-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
              API Proxy Secure
            </div>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <nav className="md:hidden flex overflow-x-auto px-4 space-x-6 text-sm font-medium text-slate-500 dark:text-slate-400 pt-1 pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button onClick={() => setActiveTab('live_status')} className={`whitespace-nowrap pb-1 ${activeTab === 'live_status' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors"}`}>Live Status</button>
          <button onClick={() => setActiveTab('train_schedule')} className={`whitespace-nowrap pb-1 ${activeTab === 'train_schedule' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors"}`}>Train Schedule</button>
          <button onClick={() => setActiveTab('trains_between')} className={`whitespace-nowrap pb-1 ${activeTab === 'trains_between' ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400" : "hover:text-slate-800 dark:hover:text-slate-200 transition-colors"}`}>Trains Between</button>
        </nav>
      </header>

      <main className="flex-grow flex flex-col lg:flex-row p-4 lg:p-8 gap-4 lg:gap-8 overflow-y-auto max-w-[1400px] mx-auto w-full">
        <div className="lg:hidden flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {activeTab === 'live_status' ? 'Search Live Status' : activeTab === 'train_schedule' ? 'Search Schedule' : 'Find Trains'}
          </span>
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {isSearchOpen ? <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
          </button>
        </div>

        <aside className={`w-full lg:w-80 flex-col gap-6 shrink-0 ${isSearchOpen ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
              {activeTab === 'live_status' ? 'Live Train Status' : activeTab === 'train_schedule' ? 'Train Schedule' : 'Trains Between'}
            </h2>
            
            {activeTab === 'live_status' && (
              <form onSubmit={fetchStatus} className="flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Train Number"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="date"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Searching..." : "Check Live Status"}
                </button>
              </form>
            )}

            {activeTab === 'train_schedule' && (
              <form onSubmit={fetchSchedule} className="flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Train Number"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={scheduleTrainNumber}
                    onChange={(e) => setScheduleTrainNumber(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Searching..." : "Check Schedule"}
                </button>
              </form>
            )}

            {activeTab === 'trains_between' && (
              <form onSubmit={fetchTrainsBetween} className="flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="From Station Code (e.g. NDLS)"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={fromStation}
                    onChange={(e) => setFromStation(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="To Station Code (e.g. BCT)"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={toStation}
                    onChange={(e) => setToStation(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="date"
                    className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white dark:placeholder-slate-400 transition-shadow"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Searching..." : "Find Trains"}
                </button>
              </form>
            )}
          </div>

          {recentSearches.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recent Searches</h2>
              </div>
              <div className="flex flex-col gap-2">
                {recentSearches.map(search => (
                  <button
                    key={search.id}
                    onClick={() => handleRecentSearchClick(search)}
                    className="text-left px-3 py-2 -mx-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </aside>

        <section className="flex-grow flex flex-col gap-6">
          {activeTab === 'live_status' && (
            statusData ? (
              <>
                <div className="bg-white dark:bg-slate-800 p-6 lg:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        {statusData.trainName}
                      </h1>
                      <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Running Status: <span className={`font-semibold ${statusData.status === 'completed' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{statusData.status === "not-started" ? "Not Started" : statusData.status === "running" ? "On Time" : statusData.status === "completed" ? "Completed" : "Unknown"}</span> • Journey: {statusData.startDate}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
                        <span>{statusData.train.source.name}</span>
                        <span className="text-slate-300 dark:text-slate-600">→</span>
                        <span>{statusData.train.destination.name}</span>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-3xl md:text-4xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{statusData.trainNumber}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Train Number</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex-grow flex flex-col overflow-hidden transition-colors">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Station Schedule</h2>
                  </div>
                  <div className="flex-grow overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase bg-white dark:bg-slate-800 sticky top-0 border-b border-slate-100 dark:border-slate-700 z-10 transition-colors">
                        <tr>
                          <th className="px-6 py-4 font-bold tracking-wider">Station</th>
                          <th className="px-6 py-4 font-bold tracking-wider">Sch. Arrival</th>
                          <th className="px-6 py-4 font-bold tracking-wider">Act. Arrival</th>
                          <th className="px-6 py-4 font-bold tracking-wider">Delay</th>
                          <th className="px-6 py-4 font-bold tracking-wider">Distance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {(statusData.route || []).filter(s => s.isHalt).map((station, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{station.stationName}</div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{station.stationCode}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                              {station.scheduledArrival ? format(new Date(station.scheduledArrival), "HH:mm, dd MMM") : "-"}
                            </td>
                            <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-bold">
                              {station.actualArrival ? format(new Date(station.actualArrival), "HH:mm, dd MMM") : "-"}
                            </td>
                            <td className="px-6 py-4">
                              {station.delayArrival !== undefined ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                  station.delayArrival > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50'
                                }`}>
                                  {station.delayArrival > 0 ? `${station.delayArrival}m late` : 'On Time'}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">
                              {station.distance} km
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex-grow flex flex-col justify-center items-center p-8 text-center min-h-[400px] transition-colors">
                <Train className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">No Train Selected</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Enter a train number and date to track live status.</p>
              </div>
            )
          )}

          {activeTab === 'train_schedule' && (
            scheduleData ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex-grow flex flex-col overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Full Train Route</h2>
                </div>
                <div className="flex-grow overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase bg-white dark:bg-slate-800 sticky top-0 border-b border-slate-100 dark:border-slate-700 z-10 transition-colors">
                      <tr>
                        <th className="px-6 py-4 font-bold tracking-wider">Seq</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Station</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Arrival</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Departure</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Distance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {(scheduleData.stations || []).map((station, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{station.seq}</td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{station.station}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{station.arrival || "Start"}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{station.departure || "End"}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{station.distance} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex-grow flex flex-col justify-center items-center p-8 text-center min-h-[400px] transition-colors">
                <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Search Train Route</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Enter a train number to see its complete schedule.</p>
              </div>
            )
          )}

          {activeTab === 'trains_between' && (
            trainsBetweenData ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex-grow flex flex-col overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trains Found</h2>
                  <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">{trainsBetweenData.count} Trains</span>
                </div>
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4">
                  {(trainsBetweenData.trains || []).map((trainObj, idx) => (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-6 hover:border-indigo-200 dark:hover:border-indigo-500/50 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{trainObj.train.name}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{trainObj.train.type} • {trainObj.distance} km</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{trainObj.train.number}</div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mt-1">{Math.floor(trainObj.duration / 60)}h {trainObj.duration % 60}m</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl">
                        <div className="flex-1">
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{trainObj.from.departure}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{trainObj.from.name} ({trainObj.from.code})</div>
                        </div>
                        <div className="text-slate-300 dark:text-slate-600">→</div>
                        <div className="flex-1 text-right">
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{trainObj.to.arrival}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{trainObj.to.name} ({trainObj.to.code})</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex-grow flex flex-col justify-center items-center p-8 text-center min-h-[400px] transition-colors">
                <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Find Trains</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Enter source and destination stations to find available trains.</p>
              </div>
            )
          )}
        </section>
      </main>

      <footer className="bg-slate-100 dark:bg-slate-800/50 px-4 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0 border-t border-slate-200 dark:border-slate-700 transition-colors">
        <div className="flex flex-wrap justify-center items-center gap-4 lg:gap-6 mb-2 md:mb-0">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
            Server Proxy: <span className="ml-1 font-bold text-slate-700 dark:text-slate-300">Enabled</span>
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
            Rate Limit: <span className="ml-1 font-bold text-slate-700 dark:text-slate-300">Active</span>
          </div>
          <div className="flex items-center">
            <AlertCircle className="w-3 h-3 mr-1 text-slate-400 dark:text-slate-500" />
            SSL Interception Shielded
          </div>
        </div>
        <div>© {new Date().getFullYear()} RailTrack Global Services. Unauthorized scraping is prohibited.</div>
      </footer>
    </div>
  );
}


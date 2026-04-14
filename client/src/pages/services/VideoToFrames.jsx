import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, Film, Settings, 
  Clock, Image as ImageIcon,
  Monitor, BarChart3, Scissors,
  Download, CheckCircle2,
  XCircle, Loader2, Info, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';

const VideoToFrames = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  
  // State
  const [videoQueue, setVideoQueue] = useState([]); // [{ id, file, url, name, metadata, progress, status }]
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const cancelRef = useRef(false);
  const [totalProgress, setTotalProgress] = useState(0);
  const [liveThumbnails, setLiveThumbnails] = useState([]);
  const [results, setResults] = useState(null); 
  const [statusMessage, setStatusMessage] = useState('');
  const [eta, setEta] = useState('');

  // Settings
  const [settings, setSettings] = useState({
    fps: 5,
    format: "jpg",
    quality: 85,
    resolution: "original",
    customWidth: "",
    customHeight: "",
    namingPattern: "{video}_{n}"
  });

  const [estimate, setEstimate] = useState({ count: 0, size: "0 MB" });

  useEffect(() => {
    let totalCount = 0;
    videoQueue.forEach(v => {
      if (v.metadata) {
        totalCount += Math.ceil(v.metadata.duration * settings.fps);
      }
    });
    
    const avgSize = settings.format === 'png' ? 0.8 : 0.15;
    const totalSize = (totalCount * avgSize * (settings.quality / 100)).toFixed(1);
    setEstimate({ count: totalCount, size: totalSize });
  }, [settings, videoQueue]);

  const handleFileUpload = async (e) => {
    const rawFiles = Array.from(e.target.files);
    const queueItems = [];
    
    setIsPreparing(true);
    cancelRef.current = false;
    setTotalProgress(0);

    for (const file of rawFiles) {
      if (cancelRef.current) break;

      if (file.type.startsWith('video/')) {
        queueItems.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          url: URL.createObjectURL(file),
          metadata: null,
          progress: 0,
          status: 'pending'
        });
      } else if (file.name.endsWith('.zip') || file.type === 'application/zip') {
        try {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          const entries = Object.entries(contents.files).filter(([p, z]) => !z.dir && isVideoFile(p));
          
          for (const [path, zipEntry] of entries) {
            if (cancelRef.current) break;
            const size = zipEntry._data.uncompressedSize || 0;
            queueItems.push({
              id: Math.random().toString(36).substr(2, 9),
              zipEntry,
              name: path.split('/').pop(),
              url: null,
              metadata: { duration: 0, width: 0, height: 0, size: (size / (1024 * 1024)).toFixed(2), isZip: true },
              progress: 0,
              status: 'pending',
              sizeInBytes: size
            });
          }
        } catch (err) {
          console.error("Zip error:", err);
        }
      }
    }

    if (!cancelRef.current) {
      setVideoQueue(prev => [...prev, ...queueItems]);
    }
    
    setIsPreparing(false);
    setStatusMessage('');
  };

  const isVideoFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
  };

  const getMimeType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'webm': 'video/webm'
    };
    return map[ext] || 'video/mp4';
  };

  const addFilesToQueue = (files) => {
    const newItems = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      metadata: null,
      progress: 0,
      status: 'pending'
    }));
    setVideoQueue(prev => [...prev, ...newItems]);
  };

  const removeFile = (id) => {
    const item = videoQueue.find(v => v.id === id);
    if (item) URL.revokeObjectURL(item.url);
    setVideoQueue(prev => prev.filter(v => v.id !== id));
  };

  const onVideoMetaLoad = (id, e) => {
    const v = e.target;
    setVideoQueue(prev => prev.map(item => 
      item.id === id ? {
        ...item,
        metadata: {
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
          size: item.file ? (item.file.size / (1024 * 1024)).toFixed(2) : (item.sizeInBytes ? (item.sizeInBytes / (1024 * 1024)).toFixed(2) : '---')
        }
      } : item
    ));
  };

  const extractFrames = async () => {
    setIsExtracting(true);
    cancelRef.current = false;
    setTotalProgress(0);
    setLiveThumbnails([]);
    const allResults = {};
    let totalCaptured = 0;
    const startTimeStamp = Date.now();

    for (let i = 0; i < videoQueue.length; i++) {
      if (cancelRef.current) break;
      setCurrentVideoIndex(i);
      let currentItem = videoQueue[i];
      let activeUrl = currentItem.url;
      let needsCleanup = false;

      try {
        if (currentItem.zipEntry && !activeUrl) {
          setStatusMessage(`Extracting ${currentItem.name}...`);
          const blob = await currentItem.zipEntry.async('blob');
          activeUrl = URL.createObjectURL(blob);
          needsCleanup = true;
          
          const tempV = document.createElement('video');
          tempV.src = activeUrl;
          await Promise.race([
            new Promise(r => tempV.onloadedmetadata = r),
            new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 5000))
          ]);
          
          currentItem.metadata = {
            duration: tempV.duration,
            width: tempV.videoWidth,
            height: tempV.videoHeight,
            size: (blob.size / (1024 * 1024)).toFixed(2)
          };
        }

        if (!currentItem.metadata) continue;
        const video = videoRef.current;
        video.src = activeUrl;
        
        const { duration } = currentItem.metadata;
        const interval = 1 / settings.fps;
        let currentTime = 0;
        let videoFramesCaptured = 0;

        while (currentTime <= duration) {
          if (cancelRef.current) break;

          await new Promise((resolve) => {
            const safetyTimeout = setTimeout(() => resolve(), 5000);
            video.currentTime = currentTime;
            video.onseeked = async () => {
              clearTimeout(safetyTimeout);
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              
              const targetWidth = settings.resolution === 'custom' ? (parseInt(settings.customWidth) || video.videoWidth) : video.videoWidth;
              const targetHeight = settings.resolution === 'custom' ? (parseInt(settings.customHeight) || video.videoHeight) : video.videoHeight;

              canvas.width = targetWidth;
              canvas.height = targetHeight;
              ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

              // Captured synchronously from canvas, then compressed asynchronously
              canvas.toBlob((blob) => {
                if (blob && !cancelRef.current) {
                  if (!allResults[currentItem.name]) allResults[currentItem.name] = [];
                  const frameName = settings.namingPattern.replace('{video}', currentItem.name.split('.')[0]).replace('{n}', Math.floor(currentTime * settings.fps));
                  allResults[currentItem.name].push({ name: `${frameName}.${settings.format}`, blob, size: blob.size });
                  
                  totalCaptured++;
                  videoFramesCaptured++;

                  // Throttle UI updates (every 10 frames)
                  if (videoFramesCaptured % 10 === 0) {
                    const vProg = Math.min(100, Math.round((currentTime / duration) * 100));
                    setVideoQueue(prev => prev.map((v, idx) => idx === i ? { ...v, progress: vProg, status: 'processing' } : v));
                    const overallProg = Math.round(((i / videoQueue.length) + (vProg / 100 / videoQueue.length)) * 100);
                    setTotalProgress(overallProg);
                    setLiveThumbnails(prev => [URL.createObjectURL(blob), ...prev].slice(0, 4));
                  }
                }
                resolve();
              }, `image/${settings.format === 'jpg' ? 'jpeg' : settings.format}`, settings.quality / 100);
            };
          });

          currentTime += interval;
          // Faster yielding (0ms) - only 10ms every 20 frames
          if (videoFramesCaptured % 20 === 0) {
            await new Promise(r => setTimeout(r, 10));
          } else {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } catch (err) {
        console.error("Video processing error:", err);
      } finally {
        if (needsCleanup) URL.revokeObjectURL(activeUrl);
        setVideoQueue(prev => prev.map((v, idx) => idx === i ? { ...v, status: cancelRef.current ? 'pending' : 'completed', progress: cancelRef.current ? 0 : 100 } : v));
      }
    }

    if (!cancelRef.current) {
      setResults({
        batch: allResults,
        timeTaken: ((Date.now() - startTimeStamp) / 1000).toFixed(1),
        totalFrames: totalCaptured,
        totalSize: (Object.values(allResults).flat().reduce((a, b) => a + b.size, 0) / (1024 * 1024)).toFixed(1)
      });
      setTotalProgress(100);
    } else {
      setVideoQueue([]);
      setTotalProgress(0);
    }
    setIsExtracting(false);
    setCurrentVideoIndex(-1);
  };

  const downloadBatchZip = async () => {
    const zip = new JSZip();
    const root = zip.folder(`cortexa_frames_${Date.now()}`);

    for (const [videoName, frames] of Object.entries(results.batch)) {
      const folderName = videoName.replace(/\.[^/.]+$/, "");
      const folder = root.folder(folderName);
      const padding = String(frames.length).length;
      
      frames.forEach((blob, i) => {
        const fileName = settings.namingPattern
          .replace('{video}', folderName)
          .replace('{n}', (i + 1).toString().padStart(Math.max(3, padding), '0'))
          + '.' + settings.format;
        folder.file(fileName, blob);
      });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortexa_batch_frames.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#050508] min-h-screen text-white font-sans selection:bg-[#C17BFF]/30 pb-20 pt-32">
      <div className="container mx-auto px-6 max-w-6xl">
        
        <header className="mb-12">
          <button onClick={() => navigate('/services')} className="flex items-center gap-2 text-slate-400 hover:text-[#C17BFF] transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Services</span>
          </button>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 tracking-tight">Batch Frame Extractor</h1>
              <p className="text-slate-400 font-medium italic">High-speed local processing for neural datasets.</p>
            </div>
            <div className="hidden md:block text-right">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C17BFF] font-black">Active Queue</span>
              <p className="text-3xl font-mono font-bold leading-none">{videoQueue.length}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Multi-Upload Zone */}
            <section className="bg-[#0D0D15] rounded-3xl border border-white/5 p-8 transition-all hover:border-[#C17BFF]/20 relative">
              <div className="border-2 border-dashed border-white/10 rounded-2xl py-12 flex flex-col items-center justify-center group cursor-pointer hover:border-[#C17BFF]/40 transition-all bg-[#08080C] relative">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" id="video-upload" accept="video/*,.zip" onChange={handleFileUpload} disabled={isExtracting} />
                <div className="flex flex-col items-center pointer-events-none">
                  <div className="w-16 h-16 rounded-2xl bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <span className="text-lg font-bold mb-2">Click or Drag Videos/ZIP</span>
                  <span className="text-slate-500 text-sm">Upload multiple files or a single ZIP archive</span>
                </div>
              </div>

              {/* Queue List */}
              {videoQueue.length > 0 && (
                <div className="mt-8 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Batch Queue</h3>
                  <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {videoQueue.map((item, idx) => (
                      <div key={item.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${idx === currentVideoIndex ? 'bg-[#C17BFF]/10 border-[#C17BFF]/40 shadow-[0_0_20px_rgba(193,123,255,0.05)]' : 'bg-white/5 border-white/5'}`}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-slate-400'}`}>
                            {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Film className="w-5 h-5 transition-transform hover:scale-110" />}
                          </div>
                          <div className="truncate pr-4">
                            <p className="text-sm font-bold truncate text-slate-200">{item.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {item.metadata?.isZip ? `ZIP Archive • ${item.metadata.size}MB (Ready)` : (item.metadata ? `${item.metadata.duration.toFixed(1)}s • ${item.metadata.width}x${item.metadata.height} • ${item.metadata.size}MB` : 'Analyzing source...')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {item.status === 'processing' && (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-[#C17BFF] font-bold mb-1">{item.progress}%</span>
                              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-[#C17BFF]" initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} />
                              </div>
                            </div>
                          )}
                          {item.status === 'pending' && !isExtracting && (
                            <button onClick={() => removeFile(item.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {item.url && !item.metadata?.isZip && !item.metadata?.duration && (
                          <video src={item.url} className="hidden" onLoadedMetadata={(e) => onVideoMetaLoad(item.id, e)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <video ref={videoRef} className="hidden" muted />

            {/* Extraction Settings */}
            <section className="bg-[#0D0D15] rounded-3xl border border-white/5 p-8">
              <div className="flex items-center gap-3 mb-8">
                <Settings className="w-5 h-5 text-[#C17BFF]" />
                <h2 className="text-xl font-bold">Extraction Logic</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300 flex justify-between">Sampling Rate <span className="text-[#C17BFF] font-mono">{settings.fps} FPS</span></label>
                  <input type="range" min="1" max="60" value={settings.fps} onChange={(e) => setSettings({...settings, fps: parseInt(e.target.value)})} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#C17BFF]" />
                  <div className="flex gap-2">
                    {[1, 5, 10, 24].map(v => (
                      <button key={v} onClick={() => setSettings({...settings, fps: v})} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${settings.fps === v ? 'bg-[#C17BFF] text-white' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{v} FPS</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">File Naming Syntax</label>
                  <input 
                    type="text" value={settings.namingPattern} 
                    onChange={(e) => setSettings({...settings, namingPattern: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm font-mono text-slate-300 focus:border-[#C17BFF]/40 outline-none transition-all"
                  />
                  <div className="flex gap-4 text-[9px] text-slate-500 uppercase tracking-widest font-black">
                    <span className="bg-white/5 px-2 py-0.5 rounded italic">{"{video}"}</span>
                    <span className="bg-white/5 px-2 py-0.5 rounded italic">{"{n}"}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">Target Container</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['jpg', 'png', 'webp'].map(f => (
                      <button 
                        key={f} onClick={() => setSettings({...settings, format: f})}
                        className={`p-4 rounded-2xl border-2 text-xs font-black uppercase transition-all ${settings.format === f ? 'bg-[#C17BFF]/10 border-[#C17BFF] text-[#C17BFF]' : 'bg-white/5 border-transparent text-slate-500'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">Scaling Resolution</label>
                  <select 
                    value={settings.resolution}
                    onChange={(e) => setSettings({...settings, resolution: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl h-[52px] px-4 text-sm outline-none cursor-pointer focus:border-[#C17BFF]/40 transition-all font-bold"
                  >
                    <option value="original">Original Aspect Ratio</option>
                    <option value="1080p">1080p (Cinema Wide)</option>
                    <option value="720p">720p (HD Ready)</option>
                    <option value="custom">Manual Dimensions</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {/* Action Card */}
            <section className="bg-gradient-to-br from-[#12121A] to-[#0D0D15] rounded-[32px] border border-[#C17BFF]/20 p-8 shadow-2xl sticky top-32">
              <div className="flex items-center gap-3 mb-8">
                <BarChart3 className="w-5 h-5 text-[#C17BFF]" />
                <h2 className="text-xl font-bold">Process Insight</h2>
              </div>
              <div className="space-y-5 text-sm mb-10">
                <div className="flex justify-between items-center group">
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Total Frames</span>
                  <span className="font-bold text-[#C17BFF] text-lg font-mono">{estimate.count}</span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">Extracted Size</span>
                  <span className="font-bold text-slate-200 font-mono">~{estimate.size} MB</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-4 bg-green-500/10 rounded-xl border border-green-500/20">
                  <span className="text-green-500 text-[10px] font-black uppercase tracking-tighter text-nowrap">Local Engine</span>
                  <span className="font-black text-green-400 text-xs">READY</span>
                </div>
              </div>

              <button 
                disabled={videoQueue.length === 0 || isExtracting || isPreparing}
                onClick={extractFrames}
                className={`w-full py-5 rounded-[20px] font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${videoQueue.length === 0 || isExtracting || isPreparing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#C17BFF] text-white hover:bg-[#A855F7] hover:scale-[1.02] active:scale-[0.98] shadow-[#C17BFF]/30'}`}
              >
                {(isExtracting || isPreparing) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />}
                {isPreparing ? 'Unpacking ZIP...' : (isExtracting ? 'Processing Batch...' : 'Begin Extraction')}
              </button>

              {(isExtracting || isPreparing) && (
                <div className="mt-10 space-y-6 animate-in fade-in zoom-in-95">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-400 uppercase font-black tracking-widest px-1">
                      <span>{isPreparing ? 'Preparing Files' : 'Overall Progress'}</span>
                      <span className="text-[#C17BFF]">{isPreparing ? 'Wait' : `${totalProgress}%`}</span>
                    </div>
                    {isPreparing ? (
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-[#C17BFF]" animate={{ x: [-100, 400] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '40%' }} />
                      </div>
                    ) : (
                      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <motion.div className="h-full bg-gradient-to-r from-[#C17BFF] to-[#A855F7] rounded-full shadow-[0_0_15px_rgba(193,123,255,0.4)]" initial={{ width: 0 }} animate={{ width: `${totalProgress}%` }} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 px-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{isPreparing ? statusMessage : `ETA: ${eta}`}</span>
                    </div>
                    <button onClick={() => cancelRef.current = true} className="text-red-500/70 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <XCircle className="w-3 h-3" /> STOP
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/5">
                    {liveThumbnails.map((url, i) => (
                      <div key={i} className="aspect-square bg-black rounded-lg overflow-hidden border border-white/10 ring-1 ring-white/5">
                        <img src={url} className="h-full w-full object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair" alt="stream" />
                      </div>
                    ))}
                    {[...Array(Math.max(0, 4 - liveThumbnails.length))].map((_, i) => (
                      <div key={i+100} className="aspect-square bg-white/5 rounded-lg border border-dashed border-white/10" />
                    ))}
                  </div>
                </div>
              )}

              {results && !isExtracting && (
                <div className="mt-8 p-6 bg-[#C17BFF]/5 rounded-[24px] border border-[#C17BFF]/20 text-center animate-in slide-in-from-bottom-4 duration-500">
                   <div className="w-12 h-12 rounded-2xl bg-[#C17BFF] flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-[#C17BFF]/20">
                      <Download className="w-6 h-6" />
                   </div>
                   <h3 className="font-bold text-lg mb-1">Batch Complete</h3>
                   <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase tracking-wider">{results.totalFrames} Frames Compiled</p>
                   <button 
                     onClick={downloadBatchZip}
                     className="w-full py-4 bg-[#C17BFF] rounded-2xl text-white text-sm font-black uppercase tracking-tighter hover:scale-[1.03] active:scale-[0.97] transition-all shadow-xl shadow-[#C17BFF]/10 mb-3"
                   >
                     Collect Results
                   </button>
                   <button 
                     onClick={() => {setVideoQueue([]); setResults(null); setTotalProgress(0);}}
                     className="w-full py-2 text-slate-500 text-[10px] font-black uppercase opacity-60 hover:opacity-100 transition-opacity"
                   >
                     Reset Workspace
                   </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoToFrames;

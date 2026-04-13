import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, Film, Settings, 
  Play, Pause, Clock, Image as ImageIcon,
  Monitor, Type, BarChart3, Scissors,
  PlayCircle, Download, CheckCircle2,
  XCircle, Loader2, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';

const VideoToFrames = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  
  // State
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFrameCount, setCurrentFrameCount] = useState(0);
  const [liveThumbnails, setLiveThumbnails] = useState([]);
  const [results, setResults] = useState(null);
  const [eta, setEta] = useState('');

  // Settings
  const [settings, setSettings] = useState({
    fps: 5,
    startTime: "00:00",
    endTime: "",
    format: "jpg",
    quality: 85,
    resolution: "original",
    customWidth: "",
    customHeight: "",
    namingPattern: "frame_{n}"
  });

  // Calculate estimated frames
  const [estimate, setEstimate] = useState({ count: 0, size: "0 MB" });

  useEffect(() => {
    if (metadata) {
      const start = timeToSeconds(settings.startTime);
      const end = settings.endTime ? timeToSeconds(settings.endTime) : metadata.duration;
      const duration = Math.max(0, end - start);
      const count = Math.ceil(duration * settings.fps);
      const avgSize = settings.format === 'png' ? 0.8 : 0.15; // MB estimate
      const totalSize = (count * avgSize * (settings.quality / 100)).toFixed(1);
      setEstimate({ count, size: totalSize });
    }
  }, [settings, metadata]);

  const timeToSeconds = (time) => {
    if (!time || typeof time !== 'string') return 0;
    const parts = time.split(':');
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return 0;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const onVideoLoad = (e) => {
    const v = e.target;
    setMetadata({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      size: (videoFile.size / (1024 * 1024)).toFixed(2)
    });
    setSettings(prev => ({ ...prev, endTime: formatTime(v.duration) }));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const extractFrames = async () => {
    setIsExtracting(true);
    setIsCancelled(false);
    setProgress(0);
    setCurrentFrameCount(0);
    setLiveThumbnails([]);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let targetWidth = metadata.width;
    let targetHeight = metadata.height;

    if (settings.resolution === '1080p') { targetWidth = 1920; targetHeight = 1080; }
    else if (settings.resolution === '720p') { targetWidth = 1280; targetHeight = 720; }
    else if (settings.resolution === '480p') { targetWidth = 854; targetHeight = 480; }
    else if (settings.resolution === 'custom') {
      targetWidth = parseInt(settings.customWidth) || metadata.width;
      targetHeight = parseInt(settings.customHeight) || metadata.height;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const frames = [];
    const frameInterval = 1 / settings.fps;
    const startSec = timeToSeconds(settings.startTime);
    const endSec = settings.endTime ? timeToSeconds(settings.endTime) : metadata.duration;
    
    let currentTime = startSec;
    const startTimeStamp = Date.now();

    while (currentTime <= endSec && !isCancelled) {
      const p = new Promise((resolve) => {
        video.currentTime = currentTime;
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              frames.push(blob);
              const count = frames.length;
              setCurrentFrameCount(count);
              
              // Updates
              const prog = ((currentTime - startSec) / (endSec - startSec)) * 100;
              setProgress(Math.round(prog));
              
              // ETA
              const elapsed = (Date.now() - startTimeStamp) / 1000;
              const remaining = (elapsed / count) * (estimate.count - count);
              setEta(Math.ceil(remaining) + 's');

              // Thumbnail
              if (count % 5 === 0 || count < 5) {
                const url = URL.createObjectURL(blob);
                setLiveThumbnails(prev => [...prev.slice(-3), url]);
              }
            }
            resolve();
          }, `image/${settings.format === 'jpg' ? 'jpeg' : settings.format}`, settings.quality / 100);
        };
      });
      await p;
      currentTime += frameInterval;
      if (isCancelled) break;
    }

    if (!isCancelled) {
      setResults({
        frames,
        timeTaken: ((Date.now() - startTimeStamp) / 1000).toFixed(1),
        totalSize: (frames.reduce((a, b) => a + b.size, 0) / (1024 * 1024)).toFixed(1)
      });
    }
    setIsExtracting(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('extracted_frames');
    const padding = String(results.frames.length).length;

    results.frames.forEach((blob, i) => {
      const name = settings.namingPattern
        .replace('{n}', (i + 1).toString().padStart(padding, '0'))
        + '.' + settings.format;
      folder.file(name, blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortexa_frames_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSample = () => {
    const zip = new JSZip();
    results.frames.slice(0, 10).forEach((blob, i) => {
      zip.file(`sample_${i+1}.${settings.format}`, blob);
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url; a.download = 'cortexa_sample.zip'; a.click();
    });
  };

  return (
    <div className="bg-[#050508] min-h-screen text-white font-sans selection:bg-[#C17BFF]/30 pb-20 pt-32">
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* Section 1: Header */}
        <header className="mb-12">
          <button 
            onClick={() => navigate('/services')}
            className="flex items-center gap-2 text-slate-400 hover:text-[#C17BFF] transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Services</span>
          </button>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Video to Frame Converter</h1>
          <p className="text-slate-400">Extract high-fidelity neural training frames from your raw video footage.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {/* Section 2: Upload Zone */}
            <section className="bg-[#0D0D15] rounded-3xl border border-white/5 p-8 transition-all hover:border-[#C17BFF]/20 overflow-hidden relative">
              {!videoUrl ? (
                <div className="border-2 border-dashed border-white/10 rounded-2xl py-20 flex flex-col items-center justify-center group cursor-pointer hover:border-[#C17BFF]/40 transition-all bg-[#08080C]">
                  <input type="file" className="hidden" id="video-upload" accept="video/*" onChange={handleFileUpload} />
                  <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mb-6 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <span className="text-lg font-bold mb-2">Drag and drop video file</span>
                    <span className="text-slate-500 text-sm">MP4, MOV, AVI, MKV (Max 2GB)</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative">
                    <video 
                      ref={videoRef}
                      src={videoUrl} 
                      className="w-full h-full" 
                      controls 
                      onLoadedMetadata={onVideoLoad}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Duration', value: formatTime(metadata?.duration || 0), icon: <Clock /> },
                      { label: 'Resolution', value: `${metadata?.width || 0}x${metadata?.height || 0}`, icon: <Monitor /> },
                      { label: 'Size', value: `${metadata?.size || 0} MB`, icon: <BarChart3 /> },
                      { label: 'Frames', value: 'Auto-Detect', icon: <Film /> }
                    ].map((item, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                        <div className="text-[#C17BFF]">{item.icon}</div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500">{item.label}</p>
                          <p className="text-sm font-bold">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: Settings */}
            <section className="bg-[#0D0D15] rounded-3xl border border-white/5 p-8">
              <div className="flex items-center gap-3 mb-8">
                <Settings className="w-5 h-5 text-[#C17BFF]" />
                <h2 className="text-xl font-bold">Extraction Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* FPS Setting */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300 flex justify-between">
                    Frame Rate (FPS)
                    <span className="text-[#C17BFF]">{settings.fps} FPS</span>
                  </label>
                  <input 
                    type="range" min="1" max="60" value={settings.fps}
                    onChange={(e) => setSettings({...settings, fps: parseInt(e.target.value)})}
                    className="w-full accent-[#C17BFF]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10, 24].map(v => (
                      <button 
                        key={v}
                        onClick={() => setSettings({...settings, fps: v})}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${settings.fps === v ? 'bg-[#C17BFF] text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {v} FPS
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 italic">At {settings.fps} FPS from {formatTime(metadata?.duration || 0)} = {estimate.count} frames</p>
                </div>

                {/* Range Setting */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">Time Range</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">Start Time</span>
                      <input 
                        type="text" value={settings.startTime}
                        onChange={(e) => setSettings({...settings, startTime: e.target.value})}
                        className="w-full bg-white/5 border border-white/5 rounded-xl p-2 text-sm focus:outline-none focus:border-[#C17BFF]/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">End Time</span>
                      <input 
                        type="text" value={settings.endTime}
                        onChange={(e) => setSettings({...settings, endTime: e.target.value})}
                        className="w-full bg-white/5 border border-white/5 rounded-xl p-2 text-sm focus:outline-none focus:border-[#C17BFF]/40"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                        setSettings({...settings, startTime: '00:00', endTime: formatTime(metadata?.duration || 0)});
                    }}
                    className="text-[10px] font-bold text-[#C17BFF] hover:underline"
                  >
                    Full Video
                  </button>
                </div>

                {/* Format Setting */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">Output Format</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['jpg', 'png', 'webp'].map(f => (
                      <button 
                        key={f}
                        onClick={() => setSettings({...settings, format: f})}
                        className={`p-3 rounded-2xl border transition-all text-center ${settings.format === f ? 'bg-[#C17BFF]/10 border-[#C17BFF] text-[#C17BFF]' : 'bg-white/5 border-white/5 text-slate-400'}`}
                      >
                        <span className="text-sm font-bold uppercase">{f}</span>
                      </button>
                    ))}
                  </div>
                  {settings.format !== 'png' && (
                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 uppercase tracking-widest flex justify-between">
                         Quality
                         <span>{settings.quality}%</span>
                       </label>
                       <input 
                         type="range" min="60" max="100" value={settings.quality}
                         onChange={(e) => setSettings({...settings, quality: parseInt(e.target.value)})}
                         className="w-full accent-[#C17BFF]"
                       />
                    </div>
                  )}
                </div>

                {/* Resolution Setting */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-300">Target Resolution</label>
                  <select 
                    value={settings.resolution}
                    onChange={(e) => setSettings({...settings, resolution: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-sm focus:outline-none"
                  >
                    <option value="original">Original ({metadata?.width}x{metadata?.height})</option>
                    <option value="1080p">1080p (1920x1080)</option>
                    <option value="720p">720p (1280x720)</option>
                    <option value="480p">480p (854x480)</option>
                    <option value="custom">Custom Dimensions</option>
                  </select>
                  {settings.resolution === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="number" placeholder="Width"
                        className="bg-white/5 border border-white/5 rounded-xl p-2 text-sm"
                        onChange={(e) => setSettings({...settings, customWidth: e.target.value})}
                      />
                      <input 
                        type="number" placeholder="Height"
                        className="bg-white/5 border border-white/5 rounded-xl p-2 text-sm"
                        onChange={(e) => setSettings({...settings, customHeight: e.target.value})}
                      />
                    </div>
                  )}
                </div>

              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* Section 4: Estimated Output */}
            <section className="bg-gradient-to-br from-[#12121A] to-[#0D0D15] rounded-3xl border border-[#C17BFF]/20 p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-5 h-5 text-[#C17BFF]" />
                <h2 className="text-xl font-bold">Estimated Output</h2>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Frames to extract:</span>
                  <span className="font-bold text-[#C17BFF]">{estimate.count}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Approx. file size:</span>
                  <span className="font-bold">~{estimate.size} MB</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Format:</span>
                  <span className="font-bold uppercase">{settings.format} @ {settings.quality}%</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Resolution:</span>
                  <span className="font-bold">
                    {settings.resolution === 'original' ? `${metadata?.width || 0}x${metadata?.height || 0}` : 
                     settings.resolution === '1080p' ? '1920x1080' : 
                     settings.resolution === '720p' ? '1280x720' : 
                     settings.resolution === '480p' ? '854x480' : 'Custom'}
                  </span>
                </div>
              </div>

              {/* Section 5: Extract Button */}
              <button 
                disabled={!videoUrl || isExtracting}
                onClick={extractFrames}
                className={`w-full mt-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${!videoUrl || isExtracting ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#C17BFF] text-white hover:bg-[#A855F7] shadow-[#C17BFF]/20'}`}
              >
                {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Film className="w-5 h-5" />}
                {isExtracting ? 'Extracting...' : '🎬 Extract Frames'}
              </button>
              {videoUrl && !isExtracting && (
                <p className="text-[10px] text-center text-slate-500 mt-3 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Estimated time: ~{Math.ceil(estimate.count / 10)} seconds
                </p>
              )}
            </section>

            {/* Section 6: Progress Panel */}
            <AnimatePresence>
              {isExtracting && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-[#0D0D15] rounded-3xl border border-[#C17BFF]/40 p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                     <h3 className="font-bold">Extracting Frames...</h3>
                     <span className="text-xs text-[#C17BFF] font-mono">ETA: {eta}</span>
                  </div>
                  
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-4">
                    <motion.div 
                      className="h-full bg-[#C17BFF] shadow-[0_0_15px_rgba(193,123,255,0.5)]" 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 mb-8">
                    <span>{progress}% complete</span>
                    <span>{currentFrameCount} / {estimate.count} captured</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-8">
                    {liveThumbnails.map((url, i) => (
                      <div key={i} className="aspect-square bg-black rounded-lg overflow-hidden border border-white/10">
                        <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {[...Array(4 - liveThumbnails.length)].map((_, i) => (
                      <div key={i+100} className="aspect-square bg-white/5 rounded-lg animate-pulse" />
                    ))}
                  </div>

                  <button 
                    onClick={() => setIsCancelled(true)}
                    className="w-full py-3 rounded-xl border border-red-500/30 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Cancel Process
                  </button>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Section 7: Results Panel */}
            <AnimatePresence>
              {results && !isExtracting && (
                <motion.section 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#0D0D15] rounded-3xl border border-[#C17BFF]/40 p-8 shadow-2xl"
                >
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold">Extraction Complete!</h3>
                    <p className="text-slate-500 text-sm">{results.frames.length} frames successfully extracted.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 rounded-2xl bg-white/5 text-center">
                       <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Size</p>
                       <p className="text-lg font-bold">{results.totalSize} MB</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 text-center">
                       <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Time Taken</p>
                       <p className="text-lg font-bold">{results.timeTaken}s</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-8">
                     {results.frames.slice(0, 12).map((blob, i) => (
                        <div key={i} className="aspect-square rounded-lg overflow-hidden relative group">
                           <img src={URL.createObjectURL(blob)} className="w-full h-full object-cover" />
                           <span className="absolute bottom-1 right-1 text-[8px] bg-black/60 px-1 rounded">#{i+1}</span>
                        </div>
                     ))}
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={downloadZip}
                      className="w-full py-4 rounded-2xl bg-[#C17BFF] text-white font-bold hover:bg-[#A855F7] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#C17BFF]/20"
                    >
                      <Download className="w-5 h-5" /> Download All as ZIP
                    </button>
                    <button 
                      onClick={downloadSample}
                      className="w-full py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      Download Sample (10)
                    </button>
                    <button 
                      onClick={() => {setVideoUrl(''); setVideoFile(null); setResults(null);}}
                      className="w-full py-4 text-slate-500 text-sm font-bold hover:text-white transition-colors"
                    >
                      Start Over
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoToFrames;

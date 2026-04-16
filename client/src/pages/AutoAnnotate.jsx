import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import api from '../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UploadCloud, X, LayoutTemplate, Layers, CheckCircle, Tag, 
  FileText, Download, Settings2, Info, Video, AlertTriangle, ChevronRight, Play
} from 'lucide-react'

const PRETRAINED_CLASSES = {
  "People & Body": ["person", "face", "hand", "eye", "head", "body"],
  "Vehicles": ["car", "truck", "bus", "motorcycle", "bicycle", "airplane", "boat", "train", "van", "scooter", "ambulance", "taxi"],
  "Animals": ["cat", "dog", "bird", "horse", "cow", "sheep", "elephant", "bear", "zebra", "giraffe", "lion", "tiger", "rabbit", "fish", "monkey"],
  "Electronics": ["phone", "laptop", "computer", "keyboard", "mouse", "monitor", "tablet", "camera", "headphones", "speaker", "tv", "remote"],
  "Food & Kitchen": ["bottle", "cup", "bowl", "fork", "knife", "spoon", "plate", "pizza", "sandwich", "apple", "banana", "orange", "cake"],
  "Furniture": ["chair", "sofa", "table", "bed", "desk", "shelf", "lamp", "door", "window", "stairs"],
  "Outdoor": ["tree", "flower", "grass", "road", "traffic light", "stop sign", "fire hydrant", "bench", "building", "bridge", "fence"],
  "Sports": ["ball", "bat", "racket", "skateboard", "surfboard", "ski", "snowboard", "frisbee", "kite", "umbrella", "backpack", "suitcase"],
  "Safety": ["helmet", "mask", "gloves", "fire", "smoke", "weapon", "knife", "hard hat", "vest", "cone", "barrier"],
  "Medical": ["syringe", "pill", "bandage", "stethoscope", "wheelchair", "crutch", "xray", "mask"]
}

const COMMON_OBJECTS = ["person", "car", "dog", "cat", "phone", "laptop", "bottle", "chair"]

export default function AutoAnnotate() {
  const [files, setFiles] = useState([])
  const [labels, setLabels] = useState([])
  const [customLabel, setCustomLabel] = useState('')
  const [activeCategory, setActiveCategory] = useState("People & Body")
  const [exportFormat, setExportFormat] = useState('yolo')
  const [thresholds, setThresholds] = useState({ box: 0.20, text: 0.20 })
  const [sampleFps, setSampleFps] = useState(0) // 0 = Auto
  
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState('idle') // idle, uploading, processing, completed, failed
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [results, setResults] = useState(null)
  const pollRef = useRef(undefined)

  const isVideoPresent = files.some(f => f.type.startsWith('video/'))

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
      'application/zip': ['.zip']
    }
  })

  const toggleLabel = (label) => {
    setLabels(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  const addCustomLabel = (e) => {
    e.preventDefault()
    if (customLabel.trim() && !labels.includes(customLabel.trim().toLowerCase())) {
      setLabels(prev => [...prev, customLabel.trim().toLowerCase()])
      setCustomLabel('')
    }
  }

  const quickSelectCommon = () => {
    setLabels(prev => Array.from(new Set([...prev, ...COMMON_OBJECTS])))
  }

  const resetJob = () => {
    setJobStatus('idle')
    setJobId(null)
    setProgress(0)
    setErrorMessage('')
    setResults(null)
  }

  const startAnnotation = async () => {
    if (!files.length || !labels.length) {
      toast.error('Upload files and select at least one label.')
      return
    }

    setJobStatus('uploading')
    setErrorMessage('')
    
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      // Send as clean string
      const labelStr = labels.map(l => l.trim().toLowerCase()).join(',')
      formData.append('labels', labelStr)
      formData.append('export_format', exportFormat)
      formData.append('box_threshold', thresholds.box.toString())
      formData.append('text_threshold', thresholds.text.toString())
      formData.append('sample_fps', sampleFps.toString())

      console.log('Starting job with labels:', labelStr)

      const { data } = await api.post('/annotate/start', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0 
      })

      setJobId(data.job_id)
      setJobStatus('processing')
      startPolling(data.job_id)
    } catch (err) {
      setJobStatus('failed')
      setErrorMessage(err.response?.data?.error || err.message)
    }
  }

  const startPolling = (id) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/annotate/status/${id}`)
        setProgress(data.progress || 0)
        setStatusMessage(data.message || '')

        if (data.status === 'completed') {
          clearInterval(pollRef.current)
          setJobStatus('completed')
          setResults(data)
          toast.success('Success! Annotations ready.')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setJobStatus('failed')
          setErrorMessage(data.error || 'The AI Brain was interrupted.')
        }
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 2000)
  }

  useEffect(() => {
    return () => clearInterval(pollRef.current)
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-24">
      {/* HEADER */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Cortexa AI Multi-Engine</h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          High-precision object detection & segmentation using GroundingDINO + SAM. 
        </p>
      </div>

      {/* SECTION 1: UPLOAD */}
      <section className="bg-[#131127] border border-[#2A2740] rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[#2A2740] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#C17BFF]" /> 1. Source Data
          </h2>
          <span className="text-xs text-slate-500">{files.length} items ready</span>
        </div>
        
        <div className="p-8">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            isDragActive ? 'border-[#C17BFF] bg-[#C17BFF]/5' : 'border-[#2A2740] hover:border-[#C17BFF]/50 bg-[#0D0B1A]/50'
          }`}>
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-[#C17BFF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UploadCloud className="w-8 h-8 text-[#C17BFF]" />
            </div>
            <p className="text-white font-semibold">Drop images or video here</p>
            <p className="text-slate-500 text-sm mt-1 italic">Supports Batch JPG, PNG, MP4, MOV</p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {files.map((f, i) => (
                <div key={i} className="bg-[#1A1733] border border-[#2A2740] px-3 py-1.5 rounded-lg flex items-center gap-2 group">
                  {f.type.startsWith('image') ? <Tag className="w-3 h-3 text-emerald-400"/> : <Video className="w-3 h-3 text-sky-400"/>}
                  <span className="text-xs text-slate-300 truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: CLASS SELECTOR */}
      <section className="bg-[#131127] border border-[#2A2740] rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[#2A2740] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-[#C17BFF]" /> 2. Pretrained Class Intelligence
          </h2>
          <button onClick={quickSelectCommon} className="text-xs text-[#C17BFF] hover:underline">Select Common Objects</button>
        </div>

        <div className="flex flex-col md:flex-row h-[400px]">
          {/* Categories Sidebar */}
          <div className="w-full md:w-56 border-r border-[#2A2740] bg-[#0D0B1A]/50 overflow-y-auto">
            {Object.keys(PRETRAINED_CLASSES).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-6 py-4 text-sm font-medium transition-colors flex items-center justify-between ${
                  activeCategory === cat ? 'bg-[#C17BFF]/10 text-[#C17BFF] border-r-2 border-[#C17BFF]' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                {cat}
                {activeCategory === cat && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
            <button
               onClick={() => setActiveCategory("Custom")}
               className={`w-full text-left px-6 py-4 text-sm font-medium transition-colors ${
                 activeCategory === "Custom" ? 'bg-[#C17BFF]/10 text-[#C17BFF] border-r-2 border-[#C17BFF]' : 'text-slate-400 hover:bg-white/5'
               }`}
            >
              ⌨️ Custom Label
            </button>
          </div>

          {/* Class Grid */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#131127]">
            {activeCategory === "Custom" ? (
              <div className="space-y-6">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-200">
                    Custom labels use Open-Vocabulary detection. While powerful, accuracy is usually higher when using pretrained classes from other categories.
                  </p>
                </div>
                <form onSubmit={addCustomLabel} className="flex gap-2">
                  <input 
                    type="text" 
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Enter custom noun (e.g. coffee mug)"
                    className="flex-1 bg-[#0D0B1A] border border-[#2A2740] rounded-xl px-4 text-white focus:border-[#C17BFF] outline-none"
                  />
                  <button type="submit" className="bg-[#C17BFF] text-white px-6 py-2 rounded-xl font-bold">Add</button>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PRETRAINED_CLASSES[activeCategory].map(cls => (
                  <button
                    key={cls}
                    onClick={() => toggleLabel(cls)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                      labels.includes(cls)
                        ? 'bg-[#C17BFF] text-white border-[#C17BFF]'
                        : 'bg-[#0D0B1A] text-slate-400 border-[#2A2740] hover:border-[#C17BFF]/50'
                    }`}
                  >
                    {cls}
                    {labels.includes(cls) && <CheckCircle className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Bottom Bar */}
        <div className="p-4 bg-[#0D0B1A] border-t border-[#2A2740] flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{labels.length} Selected:</span>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {labels.map(l => (
                <motion.span 
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  key={l} className="bg-[#C17BFF]/20 text-[#C17BFF] px-2 py-1 rounded-md text-xs flex items-center gap-1"
                >
                  {l} <X className="w-3 h-3 cursor-pointer" onClick={() => toggleLabel(l)} />
                </motion.span>
              ))}
            </AnimatePresence>
            {labels.length === 0 && <span className="text-xs text-slate-600 italic">No classes selected yet...</span>}
          </div>
          <button onClick={() => setLabels([])} className="ml-auto text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded">Clear All</button>
        </div>
      </section>

      {/* SECTION 3: SENSITIVITY & VIDEO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-[#131127] border border-[#2A2740] rounded-2xl p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-400" /> 3. Sensitivity Controls
          </h2>
          
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Object Box Confidence</span>
              <span className="text-emerald-400 font-mono">{thresholds.box.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.05" max="0.50" step="0.01" value={thresholds.box}
              onChange={e => setThresholds({...thresholds, box: parseFloat(e.target.value)})}
              className="w-full accent-emerald-500"
            />
            <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Recommended: 0.20 for street/crowd. 0.35 for studio.</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Text Match Strictness</span>
              <span className="text-emerald-400 font-mono">{thresholds.text.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.05" max="0.50" step="0.01" value={thresholds.text}
              onChange={e => setThresholds({...thresholds, text: parseFloat(e.target.value)})}
              className="w-full accent-emerald-500"
            />
          </div>
        </section>

        <section className="bg-[#131127] border border-[#2A2740] rounded-2xl p-8 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-sky-400" /> 4. Video Processing
          </h2>
          
          <div className={`space-y-6 transition-opacity ${!isVideoPresent ? 'opacity-30 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <span className="text-sm font-medium text-slate-300">Frame Sampling Rate</span>
                <p className="text-xs text-slate-500">Pick "Auto" for smart balancing</p>
              </div>
              <select 
                value={sampleFps} 
                onChange={e => setSampleFps(parseFloat(e.target.value))}
                className="bg-[#0D0B1A] border border-[#2A2740] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              >
                <option value={0}>Auto (Smart)</option>
                <option value={30}>Every Frame (30 FPS)</option>
                <option value={5}>High Quality (5 FPS)</option>
                <option value={2}>Fast (2 FPS)</option>
                <option value={1}>Speed Optimized (1 FPS)</option>
              </select>
            </div>
            
            <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-500/20 text-xs text-sky-200 leading-relaxed">
              Detection is processed on each sampled frame. 5 FPS captures most action while keeping processing time under 5 mins.
            </div>
          </div>
          {!isVideoPresent && (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-slate-500 italic">No video detected in source data</span>
            </div>
          )}
        </section>
      </div>

      {/* FOOTER: START ACTION */}
      <div className="sticky bottom-6 z-40">
        <div className="bg-[#131127]/80 backdrop-blur-xl border border-[#C17BFF]/30 p-4 rounded-2xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C17BFF] to-[#9D4EDD] flex items-center justify-center">
               <Layers className="text-white w-6 h-6" />
             </div>
             <div>
               <p className="text-white font-bold">{files.length} Files • {labels.length} Classes</p>
               <p className="text-xs text-slate-400">Exporting to {exportFormat.toUpperCase()}</p>
             </div>
          </div>

          <button
            onClick={startAnnotation}
            disabled={jobStatus !== 'idle'}
            className="bg-[#C17BFF] hover:bg-[#9D4EDD] disabled:bg-slate-700 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-[#C17BFF]/30 flex items-center gap-2"
          >
            {jobStatus === 'idle' ? (<>🚀 Start AI Pipeline</>) : (<><Layers className="animate-spin w-4 h-4"/> Processing...</>)}
          </button>
        </div>
      </div>

      {/* OVERRAYS: PROGRESS & RESULTS */}
      <AnimatePresence>
        {jobStatus === 'processing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0D0B1A]/95">
             <div className="max-w-md w-full bg-[#131127] border border-[#C17BFF]/30 rounded-3xl p-10 text-center space-y-6">
                <div className="relative w-32 h-32 mx-auto">
                   <div className="absolute inset-0 rounded-full border-4 border-[#2A2740]"></div>
                   <svg className="absolute inset-0 w-full h-full -rotate-90">
                     <circle cx="64" cy="64" r="60" fill="transparent" stroke="#C17BFF" strokeWidth="8" strokeDasharray="377" strokeDashoffset={377 - (377 * progress) / 100} className="transition-all duration-1000" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">{progress}%</div>
                </div>
                <h3 className="text-2xl font-bold text-white">AI Engine Working</h3>
                <p className="text-slate-400 min-h-[40px] italic">"{statusMessage}"</p>
                <div className="flex justify-center gap-1">
                  {[...Array(3)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-[#C17BFF] animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />)}
                </div>
             </div>
          </motion.div>
        )}

        {jobStatus === 'completed' && results && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 bg-[#0D0B1A]/95 overflow-y-auto">
             <div className="max-w-5xl w-full bg-[#131127] border border-[#10B981]/30 rounded-3xl p-8 space-y-8 my-auto">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="text-3xl font-black text-white">Analysis Complete!</h3>
                      <p className="text-[#10B981] font-medium mt-1 inline-flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Ready for download
                      </p>
                   </div>
                   <button onClick={resetJob} className="p-2 hover:bg-white/10 rounded-full"><X className="text-slate-400" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {results.results?.map((res, i) => (
                     <div key={i} className="bg-[#0D0B1A] border border-[#2A2740] rounded-2xl overflow-hidden group">
                        <div className="aspect-video relative bg-slate-900 border-b border-[#2A2740]">
                          {res.preview ? (
                            <img src={`${import.meta.env.VITE_API_BASE_URL}/annotate/preview/${jobId}/${res.preview.split('/').pop()}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt=""/>
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-600"><Video className="w-8 h-8"/></div>
                          )}
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2 py-0.5 rounded uppercase">
                            {res.detections || 0} hits
                          </div>
                        </div>
                        <div className="p-4">
                           <p className="text-white text-sm font-bold truncate">{res?.file?.split(/[\\/]/).pop() || 'Unknown File'}</p>
                           <p className="text-[10px] text-[#10B981] mt-1 font-mono">{res?.labels_found?.join(', ') || 'Processing'}</p>
                        </div>
                     </div>
                   ))}
                </div>

                {isVideoPresent && (
                  <div className="p-6 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center shrink-0">
                       <Video className="w-8 h-8 text-sky-400" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                       <h4 className="text-lg font-bold text-sky-400">Annotated Video Generated</h4>
                       <p className="text-sm text-sky-200/60">Combined frame annotations into a high-quality MP4 sequence.</p>
                    </div>
                    <button className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold flex items-center gap-2">
                       <Play className="w-4 h-4" /> Watch Preview
                    </button>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-4">
                   <button onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/annotate/download/${jobId}`, '_blank')} className="flex-1 py-5 bg-[#10B981] hover:bg-[#34D399] text-[#0D0B1A] rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl">
                      <Download className="w-6 h-6" /> Download Complete ZIP
                   </button>
                   <button onClick={resetJob} className="px-8 bg-[#2A2740] hover:bg-[#3A3755] text-white rounded-2xl font-bold">New Batch</button>
                </div>
             </div>
          </motion.div>
        )}

        {jobStatus === 'failed' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0D0B1A]/95">
             <div className="max-w-md w-full bg-[#131127] border border-red-500/30 rounded-3xl p-10 text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                   <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Pipeline Error</h3>
                  <p className="text-red-400/80 mt-2 p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-sm font-mono break-all">{errorMessage}</p>
                </div>
                <div className="bg-[#1A1733] p-4 rounded-xl text-xs text-left text-slate-400 space-y-2">
                   <p className="font-bold text-slate-300">Suggestions:</p>
                   {errorMessage.includes('Model') ? <p>• Ensure weights are downloaded on the server.</p> : null}
                   <p>• Verify you have stable internet connection.</p>
                   <p>• Try selecting generic classes like "person" or "cat".</p>
                </div>
                <button onClick={resetJob} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold">Try Different Settings</button>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

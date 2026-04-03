import React, { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import api from '../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, X, LayoutTemplate, Layers, CheckCircle, Tag, FileText, Download } from 'lucide-react'

const PREDEFINED_LABELS = ['person', 'car', 'dog', 'cat', 'bicycle', 'truck', 'chair', 'bottle', 'phone', 'laptop']

export default function AutoAnnotate() {
  const [files, setFiles] = useState([])
  const [labels, setLabels] = useState([])
  const [labelInput, setLabelInput] = useState('')
  const [exportFormat, setExportFormat] = useState('yolo')
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [results, setResults] = useState(null)
  const pollRef = useRef(undefined)

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
      'application/zip': ['.zip']
    },
    multiple: true
  })

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const addLabel = (label) => {
    const trimmed = label.trim().toLowerCase()
    if (trimmed && !labels.includes(trimmed)) {
      setLabels(prev => [...prev, trimmed])
    }
    setLabelInput('')
  }

  const removeLabel = (label) => {
    setLabels(labels.filter(l => l !== label))
  }

  const handleLabelKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addLabel(labelInput)
    }
  }

  const startAnnotation = async () => {
    if (!files.length || !labels.length) {
      toast.error('Please upload files and add at least one label.')
      return
    }

    setJobStatus('uploading')
    setProgress(0)

    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      formData.append('labels', labels.join(','))
      formData.append('export_format', exportFormat)

      const { data } = await api.post(
        '/annotate/start', formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setJobId(data.job_id)
      setJobStatus('processing')
      toast.success('Annotation job started!')
      startPolling(data.job_id)
    } catch (err) {
      setJobStatus('failed')
      toast.error('Failed to start annotation')
    }
  }

  const startPolling = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/annotate/status/${id}`)
        setProgress(data.progress || 0)
        setStatusMessage(data.message || '')

        if (data.status === 'completed') {
          clearInterval(pollRef.current)
          setJobStatus('completed')
          setResults(data)
          toast.success('Annotation complete! Ready to download.')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setJobStatus('failed')
          toast.error(data.error || 'Annotation failed')
        }
      } catch {
        // keep polling
      }
    }, 2000)
  }

  const downloadResults = () => {
    if (!jobId) return
    window.open(
      `${import.meta.env.VITE_API_URL}/annotate/download/${jobId}`,
      '_blank'
    )
  }

  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB'

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 pb-24">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">AI Auto Annotation</h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Upload your dataset, type what you want to detect, and our AI pipeline powered by Grounding DINO + SAM 2 will automatically find and segment the objects. Zero manual work.
        </p>
      </div>

      {/* SECTION 1 — Upload Zone */}
      <section className="bg-[#131127] border border-[#2A2740] rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-[#C17BFF]" />
          1. Upload Dataset
        </h2>
        
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            isDragActive ? 'border-[#C17BFF] bg-[#C17BFF]/10' : 'border-[#2A2740] hover:border-[#C17BFF]/50 bg-[#0D0B1A]/50 hover:bg-[#1A1733]'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-300 font-medium mb-1">Drop images, video, or a ZIP file here</p>
          <p className="text-slate-500 text-sm">JPG, PNG, MP4, MOV, ZIP accepted</p>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-slate-400 mb-3 px-1">
              <span>{files.length} file(s) selected</span>
              <span>{formatSize(totalSize)}</span>
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-[#1A1733] p-3 rounded-lg border border-[#2A2740]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {file.type.startsWith('image/') ? (
                      <div className="w-10 h-10 rounded bg-[#2A2740] overflow-hidden flex-shrink-0">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                       <div className="w-10 h-10 rounded bg-[#2A2740] flex items-center justify-center flex-shrink-0">
                         <FileText className="w-5 h-5 text-slate-400" />
                       </div>
                    )}
                    <span className="text-slate-300 truncate text-sm">{file.name}</span>
                  </div>
                  <button onClick={() => removeFile(i)} className="p-2 hover:bg-white/10 rounded-md transition-colors">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2 — Label Input */}
      <section className="bg-[#131127] border border-[#2A2740] rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-[#C17BFF]" />
          2. What should be detected?
        </h2>
        
        <div className="space-y-4">
          <input
            type="text"
            className="w-full bg-[#0D0B1A] border border-[#2A2740] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#C17BFF] focus:ring-1 focus:ring-[#C17BFF] transition-all"
            placeholder="Type a label (e.g. car, person, traffic light) and press Enter..."
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={handleLabelKeyDown}
          />
          
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {labels.map((label) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={label}
                  className="bg-[#C17BFF]/20 text-[#C17BFF] border border-[#C17BFF]/30 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium"
                >
                  {label}
                  <button onClick={() => removeLabel(label)} className="hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="pt-2">
            <p className="text-sm text-slate-400 mb-2">Suggested labels:</p>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_LABELS.filter(l => !labels.includes(l)).map(label => (
                <button
                  key={label}
                  onClick={() => addLabel(label)}
                  className="text-xs bg-[#1A1733] text-slate-300 hover:bg-[#2A2740] border border-[#2A2740] px-3 py-1.5 rounded-full transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Export Format */}
      <section className="bg-[#131127] border border-[#2A2740] rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-[#F0A030]" />
          3. Export Format
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'yolo', label: 'YOLO TXT', desc: 'Best for training YOLO models' },
            { id: 'coco', label: 'COCO JSON', desc: 'Industry standard format' },
            { id: 'voc', label: 'Pascal VOC', desc: 'For older XML pipelines' }
          ].map(fmt => (
            <div
              key={fmt.id}
              onClick={() => setExportFormat(fmt.id)}
              className={`cursor-pointer rounded-xl p-5 border-2 transition-all ${
                exportFormat === fmt.id 
                  ? 'border-[#F0A030] bg-[#F0A030]/10' 
                  : 'border-[#2A2740] bg-[#0D0B1A] hover:border-[#2A2740]/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${exportFormat === fmt.id ? 'text-[#F0A030]' : 'text-white'}`}>
                  {fmt.label}
                </span>
                {exportFormat === fmt.id && <CheckCircle className="w-5 h-5 text-[#F0A030]" />}
              </div>
              <p className="text-slate-400 text-sm">{fmt.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — Start Button & Progress */}
      <div className="pt-6">
        {jobStatus === 'idle' && (
          <button
            onClick={startAnnotation}
            disabled={!files.length || !labels.length}
            className={`w-full py-5 rounded-xl font-bold text-lg text-white transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg ${
              !files.length || !labels.length 
                ? 'bg-[#2A2740] text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#C17BFF] to-[#9D4EDD] hover:shadow-[#C17BFF]/20 cursor-pointer'
            }`}
          >
            🚀 Start Auto Annotation
          </button>
        )}

        {(jobStatus === 'uploading' || jobStatus === 'processing') && (
          <div className="bg-[#131127] border border-[#C17BFF]/30 rounded-2xl p-8 shadow-xl overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#2A2740]">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#C17BFF] to-[#9D4EDD]"
                initial={{ width: 0 }}
                animate={{ width: `${jobStatus === 'uploading' ? 10 : progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="text-center relative z-10">
              <div className="inline-block p-4 rounded-full bg-[#C17BFF]/10 mb-4">
                <Layers className="w-8 h-8 text-[#C17BFF] animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {jobStatus === 'uploading' ? 'Uploading files...' : 'AI is analyzing your files'}
              </h3>
              <p className="text-[#C17BFF] font-medium">{progress}% Complete</p>
              <p className="text-slate-400 mt-2 text-sm max-w-md mx-auto truncate">
                {statusMessage || 'Initializing...'}
              </p>
            </div>
          </div>
        )}

        {jobStatus === 'completed' && results && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#131127] border border-[#10B981]/30 rounded-2xl p-8 shadow-xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#10B981]/20 mb-4">
                <CheckCircle className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-2xl font-bold text-white">✅ Annotation Complete!</h3>
              <p className="text-slate-400 mt-2">
                Processed successfully. AI detected targets accurately.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {results.results?.slice(0, 4).map((res, i) => (
                <div key={i} className="bg-[#0D0B1A] rounded-xl border border-[#2A2740] overflow-hidden">
                  <div className="aspect-video bg-[#1A1733] relative">
                    {res.preview && (
                       <img src={`${(import.meta.env.VITE_API_URL || '').replace('/api','')}/${res.preview}`} className="w-full h-full object-cover" alt="Preview"/>
                    )}
                  </div>
                  <div className="p-3">
                     <p className="text-sm font-medium text-white truncate">{res.file.split(/[\\/]/).pop()}</p>
                     <p className="text-xs text-slate-400">{res.detections || 0} object(s) detected</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={downloadResults}
              className="w-full py-4 rounded-xl font-bold text-lg text-[#0D0B1A] bg-[#10B981] hover:bg-[#34D399] transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg hover:shadow-[#10B981]/20"
            >
              <Download className="w-6 h-6" />
              Download Annotated Dataset (.zip)
            </button>
            <div className="text-center mt-4">
              <button 
                onClick={() => {
                  setJobStatus('idle'); setFiles([]); setLabels([]); setProgress(0); setJobId(null);
                }} 
                className="text-slate-400 hover:text-white text-sm"
              >
                Start a new job
              </button>
            </div>
          </motion.div>
        )}
        
        {jobStatus === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
             <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
             <h3 className="text-xl font-bold text-white mb-2">Annotation Failed</h3>
             <p className="text-red-400 mb-6">Something went wrong during processing. Please try again.</p>
             <button
              onClick={() => setJobStatus('idle')}
              className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../../api/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  ArrowLeft, 
  Download, 
  Star, 
  ExternalLink, 
  Copy, 
  Info, 
  Layers, 
  Filter,
  Loader2 
} from 'lucide-react'

const DATASET_TYPES = [
  { value: 'all', label: 'All Types', icon: '🗂️' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'audio', label: 'Audio', icon: '🔊' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'object-detection', label: 'Object Detection', icon: '🎯' },
  { value: 'tabular', label: 'Tabular', icon: '📊' },
  { value: 'nlp', label: 'NLP', icon: '🤖' },
]

const SOURCES = [
  { value: 'all', label: 'All Sources', icon: '🗂️' },
  { value: 'huggingface', label: 'Hugging Face', icon: '🤗' },
  { value: 'kaggle', label: 'Kaggle', icon: '📊' },
  { value: 'github', label: 'GitHub', icon: '🐙' },
  { value: 'paperswithcode', label: 'Papers With Code', icon: '📄' },
  { value: 'uci', label: 'UCI ML', icon: '🎓' },
  { value: 'roboflow', label: 'Roboflow', icon: '🔭' },
]

const POPULAR_SEARCHES = [
  { query: 'COCO detection', type: 'object-detection', label: '🎯 COCO' },
  { query: 'ImageNet', type: 'image', label: '🖼️ ImageNet' },
  { query: 'face recognition', type: 'image', label: '👤 Faces' },
  { query: 'sentiment analysis', type: 'nlp', label: '💬 Sentiment' },
  { query: 'speech commands', type: 'audio', label: '🔊 Speech' },
  { query: 'medical imaging', type: 'image', label: '🏥 Medical' },
  { query: 'autonomous driving', type: 'video', label: '🚗 Driving' },
  { query: 'mnist handwritten', type: 'image', label: '✍️ MNIST' },
  { query: 'twitter sentiment', type: 'text', label: '🐦 Twitter' },
  { query: 'aerial satellite', type: 'image', label: '🛰️ Satellite' },
]

const SOURCE_COLORS = {
  huggingface: '#FF9D00',
  kaggle: '#20BEFF',
  github: '#6E40C9',
  paperswithcode: '#21CBCE',
  uci: '#FF6B35',
  roboflow: '#8B5CF6',
  web: '#6B7280',
}

export default function DatasetSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [datasetType, setDatasetType] = useState('all')
  const [source, setSource] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [stats, setStats] = useState(null)
  const inputRef = useRef(null)
  
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query
    if (!q.trim() || q.trim().length < 2) {
      toast.error('Search query must be at least 2 characters')
      return
    }
    
    setLoading(true)
    setSearched(true)
    if (searchQuery) setQuery(searchQuery)
    
    try {
      const params = new URLSearchParams({
        query: q,
        type: datasetType,
        source: source,
        limit: '12'
      })
      
      const { data } = await api.get(`/datasets/search?${params}`)
      setResults(data.results || [])
      setStats(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }
  
  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }
  
  const formatNumber = (n) => {
    if (!n) return '0'
    if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n/1000).toFixed(1)}K`
    return String(n)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  }

  return (
    <div className="min-h-screen bg-[#0D0B1A] text-white pb-20 pt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate('/services')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors mr-4"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#C17BFF] to-[#00D1FF] bg-clip-text text-transparent">
              Dataset Collection
            </h1>
            <p className="text-gray-400">Search datasets from Hugging Face, Kaggle, GitHub, Papers With Code, UCI, and Roboflow</p>
          </div>
        </div>

        {/* Search Bar Section */}
        <div className="bg-[#161425] p-6 rounded-2xl border border-white/5 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search datasets... e.g. 'face detection', 'medical imaging'"
                className="w-full bg-[#0D0B1A] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-lg focus:outline-none focus:border-[#C17BFF] transition-all"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="bg-[#C17BFF] hover:bg-[#b06aee] text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Search size={20} />}
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-sm text-gray-400 mr-2">
              <Filter size={16} /> Filters:
            </div>
            
            <div className="flex flex-wrap gap-2">
              {DATASET_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setDatasetType(type.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    datasetType === type.value 
                      ? 'bg-[#C17BFF]/20 text-[#C17BFF] border border-[#C17BFF]/50' 
                      : 'bg-[#0D0B1A] border border-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:block h-6 w-px bg-white/10 mx-2" />

            <div className="flex gap-2">
              {SOURCES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    source === s.value
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="mr-1.5">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {stats?.sources?.map((s) => 
            s.error && (
              <div key={s.name} 
                className="text-xs text-amber-400 
                  bg-amber-900/20 px-3 py-2 rounded-lg mt-4
                  flex items-center gap-2"
              >
                ⚠️ {s.name}: {
                  s.error.includes('credentials') || s.error.includes('configured')
                    ? 'API key not configured'
                    : s.error.includes('rate limit')
                    ? 'Rate limit reached'
                    : 'Temporarily unavailable'
                }
              </div>
            )
          )}
          
          {stats?.sources?.find(
            s => s.name === 'kaggle' &&
            s.error?.includes('not configured')
          ) && (
            <div className="bg-[#1a2744] border border-[#2563EB] rounded-lg p-4 mt-2">
              <h4 className="text-[#60A5FA] font-bold mb-2">📊 Enable Kaggle Results (Free)</h4>
              <ol className="text-[#93C5FD] text-xs space-y-1.5 ml-4">
                <li>1. Go to <strong>kaggle.com</strong> → Sign in → Profile → Settings</li>
                <li>2. Scroll to <strong>API section</strong> → Click "Create New Token"</li>
                <li>3. Opens a kaggle.json file — copy username and key values</li>
                <li>4. Add to <strong>/server/.env</strong>:
                  <code className="block bg-[#0f172a] p-2 rounded mt-1 font-mono">
                    KAGGLE_USERNAME=your_username<br />
                    KAGGLE_KEY=your_api_key
                  </code>
                </li>
                <li>5. Restart the server</li>
              </ol>
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="min-h-[400px]">
          {!searched && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6 relative"
              >
                <div className="absolute inset-0 bg-[#C17BFF]/20 blur-3xl rounded-full" />
                <Layers className="w-24 h-24 text-white/10 relative z-10" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2 text-white/80">Ready to collect?</h2>
              <p className="text-gray-500 mb-8 max-w-md">Enter a query above to find high-quality datasets across the most popular sources.</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {POPULAR_SEARCHES.map(qs => (
                  <button
                    key={qs.query}
                    onClick={() => {
                      setDatasetType(qs.type)
                      handleSearch(qs.query)
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs text-gray-400 font-medium transition-all"
                  >
                    {qs.label}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#161425] h-56 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {stats && (
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 px-2 text-sm text-gray-400">
                  <div>
                    Showing <span className="text-white font-medium">{results.length}</span> results for "<span className="text-[#C17BFF] italic font-medium">{query}</span>"
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {stats.sources.map(s => (
                      <span key={s.name} style={{ color: SOURCE_COLORS[s.name] || '#fff' }} className="flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s.name] }} />
                        {s.count} from {s.name === 'huggingface' ? 'HF' : s.name === 'paperswithcode' ? 'PwC' : s.name === 'roboflow' ? 'RF' : s.name.charAt(0).toUpperCase() + s.name.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {results.map((dataset) => (
                  <motion.div
                    key={dataset.id}
                    variants={cardVariants}
                    style={{ borderTop: `2px solid ${SOURCE_COLORS[dataset.source]}20` }}
                    className="bg-[#161425] rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all flex flex-col group relative overflow-hidden"
                  >
                    {/* Source Indicator */}
                    <div 
                      className="absolute top-0 right-0 py-1.5 px-4 rounded-bl-xl text-[10px] font-black uppercase tracking-widest text-[#0D0B1A]"
                      style={{ backgroundColor: SOURCE_COLORS[dataset.source] }}
                    >
                      {dataset.sourceLabel}
                    </div>

                    <div className="mb-4 pr-16">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold line-clamp-1 text-white group-hover:text-[#C17BFF] transition-colors">
                          {dataset.title}
                        </h3>
                        {process.env.NODE_ENV === 'development' && dataset.relevanceScore !== undefined && (
                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400 whitespace-nowrap">
                            Score: {dataset.relevanceScore?.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed h-10">
                        {dataset.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                      {dataset.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-gray-500 uppercase tracking-wider font-bold border border-white/5">
                          {tag}
                        </span>
                      ))}
                      {dataset.tags.length > 3 && <span className="text-[9px] text-gray-600 self-center">+{dataset.tags.length - 3}</span>}
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Download className="text-gray-600 w-3.5 h-3.5" /> {formatNumber(dataset.downloads)}</span>
                        <span className="flex items-center gap-1.5"><Star className="text-gray-600 w-3.5 h-3.5" /> {formatNumber(dataset.likes)}</span>
                        {dataset.size && <span>📦 {dataset.size}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => copyLink(dataset.url)}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Copy Link"
                        >
                          <Copy size={16} />
                        </button>
                        <a 
                          href={dataset.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-bold border border-white/10"
                        >
                          Explore <ExternalLink size={14} className="text-[#C17BFF]" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {results.length === 0 && searched && !loading && (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-xl text-white mb-2">No datasets found for "{query}"</h3>
                  <p className="mb-4">This is a very specific topic. Try these related searches:</p>

                  <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {stats?.expandedQueries
                      ?.filter((q) => q !== query)
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSearch(suggestion)}
                          className="px-4 py-2 rounded-full border border-[#C17BFF] bg-transparent text-[#C17BFF] text-sm cursor-pointer hover:bg-[#C17BFF]/10 transition-all"
                        >
                          Try: "{suggestion}"
                        </button>
                      ))}
                  </div>

                  <p className="text-xs text-gray-500">
                    💡 Very niche topics like "chain snatching" may not have named datasets.
                    Try broader terms like "theft detection" or "crime surveillance".
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* API Info Box */}
        <div className="mt-12 p-5 bg-[#C17BFF]/5 border border-[#C17BFF]/10 rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-[#C17BFF]/10 rounded-lg shrink-0">
             <Info className="text-[#C17BFF] w-4 h-4" />
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200 uppercase tracking-widest block mb-1">Cortexa Intelligence Hub</strong>
            Search results are aggregated in real-time across Hugging Face, Kaggle, GitHub, Papers With Code, UCI ML Repository, and Roboflow Universe. All results are filtered for research quality. Kaggle requires API keys in server .env.
          </div>
        </div>
      </div>
    </div>
  )
}

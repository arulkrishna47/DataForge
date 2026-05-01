const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');

if (typeof protect !== 'function') {
  throw new Error('protect middleware is not a function - check /middleware/authMiddleware.js export');
}

function cleanDescription(desc) {
  if (!desc) return 'No description available';
  // Remove markdown, truncate
  return desc
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) + 
    (desc.length > 200 ? '...' : '');
}

function extractSizeFromTags(tags) {
  const sizeTag = tags.find(
    t => t.toLowerCase().startsWith('size_categories:')
  );
  if (sizeTag) {
    return sizeTag
      .replace('size_categories:', '')
      .replace('size-categories:', '')
      .toUpperCase();
  }
  return 'Unknown';
}

function extractLicense(tags) {
  const licenseTag = tags.find(
    t => t.toLowerCase().startsWith('license:')
  );
  if (licenseTag) {
    return licenseTag
      .replace(/^license:/i, '')
      .toUpperCase();
  }
  return 'Unknown';
}

function detectTypeFromTags(tags) {
  const tagStr = tags.join(' ').toLowerCase();
  if (tagStr.includes('image-classification') ||
      tagStr.includes('object-detection') ||
      tagStr.includes('image-segmentation') ||
      tagStr.includes('modality:image'))
    return 'image';
  if (tagStr.includes('audio') ||
      tagStr.includes('speech'))
    return 'audio';
  if (tagStr.includes('video'))
    return 'video';
  if (tagStr.includes('text-classification') ||
      tagStr.includes('token-classification') ||
      tagStr.includes('modality:text'))
    return 'text';
  if (tagStr.includes('tabular'))
    return 'tabular';
  return 'general';
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat(
    (bytes / Math.pow(k, i)).toFixed(1)
  )} ${sizes[i]}`;
}

function expandQuery(query) {
  const q = query.toLowerCase().trim();
  const expansions = {
    'chain snatching': [
      'theft detection', 'robbery surveillance',
      'crime video', 'snatch theft', 'street crime',
      'bag snatching', 'purse snatching'
    ],
    'phone snatching': [
      'theft detection', 'robbery', 'crime surveillance',
      'mobile theft', 'street crime'
    ],
    'shoplifting': [
      'retail theft', 'store theft detection',
      'anomaly detection retail', 'shop crime'
    ],
    'brain tumor': [
      'brain mri', 'tumor detection', 'medical imaging',
      'cancer detection', 'mri segmentation'
    ],
    'chest xray': [
      'lung disease', 'pneumonia detection',
      'pulmonary', 'radiology dataset'
    ],
    'traffic accident': [
      'vehicle collision', 'road accident detection',
      'dashcam', 'autonomous driving safety'
    ],
  };

  for (const [key, related] of Object.entries(expansions)) {
    if (q.includes(key) || key.includes(q)) {
      return [query, ...related];
    }
  }

  const words = q.split(' ').filter(w => w.length > 3);
  const expanded = [query];

  if (words.length > 1) {
    expanded.push(words[0]);
    expanded.push(words[words.length - 1]);
  }

  const domainMap = {
    'detect': ['detection dataset', 'anomaly'],
    'crime': ['surveillance', 'cctv', 'security camera'],
    'theft': ['robbery', 'crime detection', 'surveillance'],
    'medical': ['clinical', 'health', 'diagnosis'],
    'traffic': ['vehicle', 'road', 'autonomous driving'],
    'face': ['facial recognition', 'face detection'],
    'text': ['nlp', 'natural language'],
    'audio': ['speech', 'sound classification'],
  };

  for (const [domain, related] of Object.entries(domainMap)) {
    if (q.includes(domain)) {
      expanded.push(...related.slice(0, 2));
    }
  }

  return [...new Set(expanded)].slice(0, 4);
}

async function searchHuggingFace(query, type, limit) {
  try {
    const queries = expandQuery(query);
    let allResults = [];

    for (const q of queries) {
      if (allResults.length >= limit) break;

      try {
        const params = new URLSearchParams();
        params.set('search', q);
        params.set('limit', '20');
        params.set('sort', 'downloads');
        params.set('direction', '-1');
        params.set('full', 'false');

        const taskMap = {
          'image': 'image-classification',
          'object-detection': 'object-detection',
          'video': 'video-classification',
          'text': 'text-classification',
          'audio': 'automatic-speech-recognition',
          'nlp': 'text-generation',
          'tabular': 'tabular-classification',
        };
        if (type && type !== 'all' && taskMap[type]) {
          params.set('filter', taskMap[type]);
        }

        const url = `https://huggingface.co/api/datasets?${params}`;

        const headers = {
          'Accept': 'application/json',
          'User-Agent': 'Cortexa/1.0'
        };
        const hfToken = process.env.HF_TOKEN || '';
        if (hfToken) {
          headers['Authorization'] = `Bearer ${hfToken}`;
        }

        const response = await axios.get(url, {
          headers,
          timeout: 12000
        });

        const datasets = Array.isArray(response.data)
          ? response.data : [];

        const queryLower = query.toLowerCase();
        for (const d of datasets) {
          if (allResults.find(r => r.id === d.id)) {
            continue;
          }

          let score = 0;
          const id = (d.id || '').toLowerCase();
          const tags = (d.tags || []).join(' ').toLowerCase();

          if (id.includes(queryLower)) score += 80;
          if (tags.includes(queryLower)) score += 40;
          if (id.includes(q.toLowerCase())) score += 30;
          score += Math.log10((d.downloads || 1) + 1) * 5;

          allResults.push({ ...d, _score: score });
        }
      } catch (innerErr) {
        console.log(`HF search failed for "${q}": ${innerErr}`);
        continue;
      }
    }

    allResults.sort((a, b) => b._score - a._score);

    const seen = new Set();
    const unique = allResults.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    }).slice(0, limit);

    return {
      source: 'huggingface',
      results: unique.map(d => ({
        id: d.id,
        title: d.id,
        description: cleanDescription(
          d.description ||
          d.cardData?.description ||
          'No description available'
        ),
        source: 'huggingface',
        sourceLabel: 'Hugging Face',
        sourceLogo: '🤗',
        url: `https://huggingface.co/datasets/${d.id}`,
        previewUrl: `https://huggingface.co/datasets/${d.id}`,
        downloads: d.downloads || 0,
        likes: d.likes || 0,
        tags: (d.tags || [])
          .filter(t =>
            !t.startsWith('license:') &&
            t.length < 40
          ).slice(0, 6),
        size: extractSizeFromTags(d.tags || []),
        license: extractLicense(d.tags || []),
        lastModified: d.lastModified,
        type: detectTypeFromTags(d.tags || []),
        relevanceScore: d._score || 0,
        authorName: (d.id || '').split('/')[0] || '',
      }))
    };
  } catch (err) {
    console.error('HF error:', err.message);
    return {
      source: 'huggingface',
      results: [],
      error: err.message
    };
  }
}

async function searchKaggle(query, type, limit) {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;

  if (!username || !key ||
      username === 'your_kaggle_username' ||
      key === 'your_kaggle_api_key') {
    return {
      source: 'kaggle',
      results: [],
      error: 'KAGGLE_USERNAME and KAGGLE_KEY not configured in .env'
    };
  }

  const queries = expandQuery(query);
  let allResults = [];

  for (const q of queries) {
    if (allResults.length >= limit) break;

    try {
      const credentials = Buffer.from(
        `${username}:${key}`
      ).toString('base64');

      const params = new URLSearchParams({
        search: q,
        page: '1',
        pageSize: String(Math.min(limit * 2, 20)),
        sortBy: 'hottest',
        group: 'public',
      });

      const fileTypeMap = {
        'image': 'imgAndVid',
        'video': 'imgAndVid',
        'text': 'csv',
        'tabular': 'csv',
      };
      if (type && type !== 'all' && fileTypeMap[type]) {
        params.set('fileType', fileTypeMap[type]);
      }

      const url = `https://www.kaggle.com/api/v1/datasets/list?${params}`;

      console.log(`Kaggle search: "${q}"`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'python-requests/2.28.0'
        },
        timeout: 15000
      });

      const data = response.data;
      const datasets = Array.isArray(data)
        ? data
        : (data?.datasets || data?.items || []);

      const queryLower = query.toLowerCase();
      for (const d of datasets) {
        const existingId = `${d.ownerRef}/${d.datasetSlug}`;
        if (allResults.find(r => r._rawId === existingId)) continue;

        let score = 0;
        const title = (d.title || '').toLowerCase();
        const subtitle = (d.subtitle || '').toLowerCase();

        if (title.includes(queryLower)) score += 80;
        if (subtitle.includes(queryLower)) score += 40;
        if (title.includes(q.toLowerCase())) score += 30;
        score += Math.log10((d.downloadCount || 1) + 1) * 5;
        score += (d.usabilityRating || 0) * 10;

        allResults.push({ ...d, _score: score, _rawId: existingId });
      }
    } catch (err) {
      console.error(`Kaggle search "${q}" failed:`, err.response?.status, err.message);

      if (err.response?.status === 401) {
        return {
          source: 'kaggle',
          results: [],
          error: 'Invalid Kaggle credentials. Check username and API key.'
        };
      }
      if (err.response?.status === 403) {
        return {
          source: 'kaggle',
          results: [],
          error: 'Kaggle access forbidden. Regenerate your API token.'
        };
      }
      continue;
    }
  }

  allResults.sort((a, b) => b._score - a._score);
  const unique = allResults
    .filter((v, i, arr) =>
      arr.findIndex(x => x._rawId === v._rawId) === i
    ).slice(0, limit);

  return {
    source: 'kaggle',
    results: unique.map(d => ({
      id: d._rawId,
      title: d.title || d.datasetSlug,
      description: cleanDescription(
        d.subtitle || d.description ||
        'No description available'
      ),
      source: 'kaggle',
      sourceLabel: 'Kaggle',
      sourceLogo: '📊',
      url: `https://www.kaggle.com/datasets/${d._rawId}`,
      previewUrl: `https://www.kaggle.com/datasets/${d._rawId}`,
      downloads: d.downloadCount || 0,
      likes: d.voteCount || 0,
      tags: (d.tags || [])
        .map(t => typeof t === 'string' ? t : t.name)
        .slice(0, 6),
      size: formatBytes(d.totalBytes),
      license: d.licenseName || 'Unknown',
      lastModified: d.lastUpdated,
      author: d.ownerName || d.ownerRef,
      usabilityRating: d.usabilityRating,
      relevanceScore: d._score || 0,
      type: type || 'general',
    }))
  };
}

async function searchGitHub(query, type, limit) {
  try {
    const token = process.env.GITHUB_TOKEN || '';
    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Cortexa/1.0'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const typeKeywords = {
      'image': 'image dataset',
      'object-detection': 'object detection dataset',
      'video': 'video dataset',
      'text': 'text nlp dataset',
      'audio': 'audio speech dataset',
      'tabular': 'tabular csv dataset',
      'nlp': 'nlp text dataset',
    };
    
    const typeStr = type && type !== 'all'
      ? typeKeywords[type] || 'dataset'
      : 'dataset';
    
    const ghQuery = [
      query,
      typeStr,
      'topic:dataset OR topic:machine-learning',
      'NOT fork:true'
    ].join(' ');
    
    const params = new URLSearchParams({
      q: ghQuery,
      sort: 'stars',
      order: 'desc',
      per_page: String(Math.min(limit * 2, 30))
    });
    
    const url = `https://api.github.com/search/repositories?${params}`;
    
    const response = await axios.get(url, {
      headers,
      timeout: 15000
    });
    
    const repos = response.data?.items || [];
    
    const queryLower = query.toLowerCase();
    const scored = repos.map(r => {
      let score = 0;
      const name = (r.name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const topics = (r.topics || []).join(' ').toLowerCase();
      
      if (name === queryLower) score += 100;
      if (name.includes(queryLower)) score += 60;
      if (desc.includes(queryLower)) score += 40;
      if (topics.includes(queryLower)) score += 30;
      if (!name.includes('dataset') && 
          !topics.includes('dataset')) score -= 20;
      score += Math.log10(
        (r.stargazers_count || 1) + 1
      ) * 8;
      
      return { ...r, _score: score };
    });
    
    scored.sort((a, b) => b._score - a._score);
    
    const filtered = scored.filter(r => r._score > 0);
    
    return {
      source: 'github',
      results: filtered.slice(0, limit).map(r => ({
          id: r.full_name,
          title: r.name
            .replace(/-/g, ' ')
            .replace(/_/g, ' '),
          description: cleanDescription(
            r.description || 'No description available'
          ),
          source: 'github',
          sourceLabel: 'GitHub',
          sourceLogo: '🐙',
          url: r.html_url,
          previewUrl: r.html_url,
          downloads: r.forks_count || 0,
          likes: r.stargazers_count || 0,
          tags: (r.topics || []).slice(0, 6),
          size: r.size 
            ? formatBytes(r.size * 1024)
            : 'Unknown',
          license: r.license?.spdx_id || 
                   r.license?.name || 'Unknown',
          lastModified: r.updated_at,
          author: r.owner?.login,
          language: r.language,
          relevanceScore: r._score,
          type: type || 'general',
        })
      )
    };
  } catch (err) {
    console.error('GitHub error:', err.message);
    if (err.response?.status === 403) {
      return {
        source: 'github',
        results: [],
        error: 'GitHub rate limit exceeded. Add GITHUB_TOKEN to .env for 5000 requests/hour'
      };
    }
    return {
      source: 'github',
      results: [],
      error: err.message
    };
  }
}

async function searchPapersWithCode(query, type, limit) {
  try {
    const url = new URL('https://paperswithcode.com/api/v1/datasets/');
    url.searchParams.set('q', query);
    url.searchParams.set('items_per_page', String(Math.min(limit, 10)));

    const response = await axios.get(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cortexa/1.0'
      },
      timeout: 10000
    });

    const datasets = response.data?.results || [];

    return {
      source: 'paperswithcode',
      results: datasets.map(d => ({
        id: d.id || d.name,
        title: d.name || d.full_name,
        description: cleanDescription(
          d.description || d.abstract || 'Research dataset from Papers With Code'
        ),
        source: 'paperswithcode',
        sourceLabel: 'Papers With Code',
        sourceLogo: '📄',
        url: d.url || `https://paperswithcode.com/dataset/${d.id}`,
        previewUrl: d.url || `https://paperswithcode.com/dataset/${d.id}`,
        downloads: d.paper_count || 0,
        likes: d.paper_count || 0,
        tags: (d.modalities || []).concat(d.tasks || []).slice(0, 6),
        size: 'See link',
        license: 'Various',
        lastModified: null,
        type: type || 'general',
        relevanceScore: 50,
      }))
    };
  } catch (err) {
    return {
      source: 'paperswithcode',
      results: [],
      error: err.message
    };
  }
}

async function searchUCI(query, type, limit) {
  try {
    const url = `https://archive.ics.uci.edu/api/datasets?search=${encodeURIComponent(query)}&skip=0&take=${Math.min(limit, 10)}&orderBy=NumHits&orderByAsc=false`;

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cortexa/1.0'
      },
      timeout: 10000
    });

    const datasets = response.data?.data || response.data?.datasets || response.data || [];

    const arr = Array.isArray(datasets) ? datasets : [];

    return {
      source: 'uci',
      results: arr.slice(0, limit).map(d => ({
        id: d.id || String(d.ID),
        title: d.name || d.Name,
        description: cleanDescription(
          d.abstract || d.Abstract || d.description || 'UCI ML Repository dataset'
        ),
        source: 'uci',
        sourceLabel: 'UCI ML Repository',
        sourceLogo: '🎓',
        url: d.id ? `https://archive.ics.uci.edu/dataset/${d.id}` : 'https://archive.ics.uci.edu/datasets',
        previewUrl: d.id ? `https://archive.ics.uci.edu/dataset/${d.id}` : 'https://archive.ics.uci.edu/datasets',
        downloads: d.NumHits || 0,
        likes: d.NumHits || 0,
        tags: [d.area || d.Area, d.task || d.Task, d.featureType || d.FeatureType].filter(Boolean),
        size: d.numInstances ? `${d.numInstances} instances` : 'Unknown',
        license: 'CC BY 4.0',
        lastModified: null,
        type: type || 'general',
        relevanceScore: 40,
      }))
    };
  } catch (err) {
    return {
      source: 'uci',
      results: [],
      error: err.message
    };
  }
}

async function searchRoboflow(query, type, limit) {
  try {
    const url = `https://universe.roboflow.com/search/datasets?query=${encodeURIComponent(query)}&size=${Math.min(limit, 10)}`;

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cortexa/1.0'
      },
      timeout: 10000
    });

    const datasets = response.data?.datasets || response.data?.results || [];

    if (!Array.isArray(datasets)) {
      return { source: 'roboflow', results: [] };
    }

    return {
      source: 'roboflow',
      results: datasets.slice(0, limit).map(d => ({
        id: d.id || d.slug,
        title: d.name || d.title,
        description: cleanDescription(
          d.description || `${d.images || 0} images, ${d.classes || 0} classes`
        ),
        source: 'roboflow',
        sourceLabel: 'Roboflow Universe',
        sourceLogo: '🔭',
        url: d.url || `https://universe.roboflow.com/${d.id}`,
        previewUrl: d.url || `https://universe.roboflow.com/${d.id}`,
        downloads: d.downloads || 0,
        likes: d.stars || 0,
        tags: (d.classes || []).slice(0, 6),
        size: d.images ? `${d.images} images` : 'Unknown',
        license: d.license || 'See link',
        lastModified: d.updatedAt || null,
        type: 'image',
        relevanceScore: 60,
      }))
    };
  } catch (err) {
    return {
      source: 'roboflow',
      results: [],
      error: 'Roboflow search unavailable'
    };
  }
}

async function searchGoogleDatasets(query, type, limit) {
  try {
    const searchQuery = `${query} dataset filetype:json OR filetype:csv`;
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' dataset site:kaggle.com OR site:huggingface.co OR site:zenodo.org')}&format=json&no_html=1&skip_disambig=1`;

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Cortexa/1.0' },
      timeout: 8000
    });

    const results = response.data?.RelatedTopics || [];

    return {
      source: 'web',
      results: results
        .filter(r => r.FirstURL && r.Text)
        .slice(0, limit)
        .map(r => ({
          id: r.FirstURL,
          title: r.Text?.split(' - ')[0] || query,
          description: cleanDescription(r.Text || 'Dataset found on the web'),
          source: 'web',
          sourceLabel: 'Web Search',
          sourceLogo: '🌐',
          url: r.FirstURL,
          previewUrl: r.FirstURL,
          downloads: 0,
          likes: 0,
          tags: [type || 'general'],
          size: 'See link',
          license: 'Various',
          lastModified: null,
          type: type || 'general',
          relevanceScore: 20,
        }))
    };
  } catch (err) {
    return { source: 'web', results: [] };
  }
}

router.get('/search', protect, async (req, res) => {
  try {
    const {
      query = '',
      type = 'all',
      source = 'all',
      limit = '8',
    } = req.query;

    const q = query.trim();
    if (q.length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters'
      });
    }

    const maxPerSource = Math.min(
      parseInt(limit) || 8, 15
    );

    const ALL_SOURCES = [
      'huggingface',
      'kaggle',
      'github',
      'paperswithcode',
      'uci',
      'roboflow',
    ];

    const sources = source === 'all'
      ? ALL_SOURCES
      : [source];

    console.log(
      `Search: "${q}" type=${type} ` +
      `sources=${sources.join(',')}`
    );

    const searchFunctions = {
      huggingface: searchHuggingFace,
      kaggle: searchKaggle,
      github: searchGitHub,
      paperswithcode: searchPapersWithCode,
      uci: searchUCI,
      roboflow: searchRoboflow,
    };

    const searchPromises = sources.map(src => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 20000)
      );

      const fn = searchFunctions[src];
      if (!fn) return Promise.resolve({ source: src, results: [] });

      return Promise.race([fn(q, type, maxPerSource), timeout])
        .catch(e => ({
          source: src,
          results: [],
          error: e.message
        }));
    });

    const allResults = await Promise.all(searchPromises);

    const combined = allResults.flatMap(r => r.results || []);

    const seenUrls = new Set();
    const unique = combined.filter(r => {
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    unique.sort((a, b) =>
      (b.relevanceScore || 0) -
      (a.relevanceScore || 0)
    );

    const sourceStats = allResults.map(r => ({
      name: r.source,
      count: (r.results || []).length,
      error: r.error || null
    }));

    console.log(
      `Results: ${unique.length} total - ` +
      sourceStats.map(s => `${s.count} from ${s.name}`).join(', ')
    );

    return res.json({
      query: q,
      type,
      total: unique.length,
      sources: sourceStats,
      results: unique,
      expandedQueries: expandQuery(q),
    });

  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({
      error: 'Search failed: ' + err.message
    });
  }
});

module.exports = router;

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

async function searchHuggingFace(query, type, limit) {
  try {
    const params = new URLSearchParams();
    params.set('search', query);
    params.set('limit', String(Math.min(limit, 20)));
    params.set('sort', 'downloads');
    params.set('direction', '-1');
    params.set('full', 'true');
    
    // Map type to HuggingFace task categories
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
    
    const hfToken = process.env.HF_TOKEN || '';
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'Cortexa/1.0'
    };
    if (hfToken) {
      headers['Authorization'] = `Bearer ${hfToken}`;
    }
    
    const response = await axios.get(url, {
      headers,
      timeout: 15000
    });
    
    const datasets = Array.isArray(response.data)
      ? response.data
      : [];
    
    const queryLower = query.toLowerCase();
    const scored = datasets.map(d => {
      let score = 0;
      const id = (d.id || '').toLowerCase();
      const desc = (
        d.description || 
        d.cardData?.description || ''
      ).toLowerCase();
      const tags = (d.tags || []).join(' ').toLowerCase();
      
      if (id === queryLower) score += 100;
      if (id.includes(queryLower)) score += 50;
      if (desc.includes(queryLower)) score += 30;
      if (tags.includes(queryLower)) score += 20;
      score += Math.log10((d.downloads || 1) + 1) * 5;
      
      return { ...d, _score: score };
    });
    
    scored.sort((a, b) => b._score - a._score);
    
    return {
      source: 'huggingface',
      results: scored.slice(0, limit).map(d => ({
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
            t.length < 30
          )
          .slice(0, 6),
        size: extractSizeFromTags(d.tags || []),
        license: extractLicense(d.tags || []),
        lastModified: d.lastModified,
        type: detectTypeFromTags(d.tags || []),
        relevanceScore: d._score,
        authorName: d.id?.split('/')[0] || '',
      }))
    };
  } catch (err) {
    console.error('HF search error:', err.message);
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
  
  if (!username || !key) {
    console.log('Kaggle credentials not set');
    return {
      source: 'kaggle',
      results: [],
      error: 'KAGGLE_USERNAME and KAGGLE_KEY not configured'
    };
  }
  
  try {
    const credentials = Buffer.from(
      `${username}:${key}`
    ).toString('base64');
    
    const params = new URLSearchParams();
    params.set('search', query);
    params.set('page', '1');
    params.set('pageSize', String(Math.min(limit, 20)));
    params.set('sortBy', 'hottest');
    
    const fileTypeMap = {
      'image': 'imgAndVid',
      'video': 'imgAndVid',
      'text': 'csv',
      'tabular': 'csv',
      'audio': 'other',
    };
    if (type && type !== 'all' && fileTypeMap[type]) {
      params.set('fileType', fileTypeMap[type]);
    }
    
    const url = `https://www.kaggle.com/api/v1/datasets/list?${params}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Cortexa/1.0'
      },
      timeout: 15000
    });
    
    const datasets = Array.isArray(response.data)
      ? response.data
      : (response.data?.datasets || []);
    
    const queryLower = query.toLowerCase();
    const scored = datasets.map(d => {
      let score = 0;
      const title = (d.title || '').toLowerCase();
      const subtitle = (d.subtitle || '').toLowerCase();
      const slug = (d.datasetSlug || '').toLowerCase();
      
      if (title === queryLower) score += 100;
      if (title.includes(queryLower)) score += 60;
      if (subtitle.includes(queryLower)) score += 30;
      if (slug.includes(queryLower)) score += 20;
      score += Math.log10(
        (d.downloadCount || 1) + 1
      ) * 5;
      score += (d.usabilityRating || 0) * 10;
      
      return { ...d, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);
    
    return {
      source: 'kaggle',
      results: scored.slice(0, limit).map(d => ({
        id: `${d.ownerRef}/${d.datasetSlug}`,
        title: d.title || d.datasetSlug,
        description: cleanDescription(
          d.subtitle || 
          d.description || 
          'No description available'
        ),
        source: 'kaggle',
        sourceLabel: 'Kaggle',
        sourceLogo: '📊',
        url: `https://www.kaggle.com/datasets/${d.ownerRef}/${d.datasetSlug}`,
        previewUrl: `https://www.kaggle.com/datasets/${d.ownerRef}/${d.datasetSlug}`,
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
        relevanceScore: d._score,
        type: type || 'general',
      }))
    };
  } catch (err) {
    console.error('Kaggle error:', err.message);
    if (err.response?.status === 401) {
      return {
        source: 'kaggle',
        results: [],
        error: 'Invalid Kaggle credentials. Check KAGGLE_USERNAME and KAGGLE_KEY'
      };
    }
    if (err.response?.status === 403) {
      return {
        source: 'kaggle',
        results: [],
        error: 'Kaggle API access forbidden. Verify your API token is active.'
      };
    }
    return {
      source: 'kaggle',
      results: [],
      error: err.message
    };
  }
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

router.get('/search', protect, async (req, res) => {
  try {
    const {
      query = '',
      type = 'all',
      source = 'all',
      limit = '8',
      page = '1'
    } = req.query;

    const q = query.trim();
    if (q.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const maxPerSource = Math.min(
      parseInt(limit) || 8, 15
    );
    const sources = source === 'all'
      ? ['huggingface', 'kaggle', 'github']
      : [source];

    console.log(
      `Searching: "${q}" type=${type} ` +
      `sources=${sources.join(',')}`
    );

    // Run all in parallel with timeout
    const searchPromises = sources.map(src => {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 20000)
      );
      
      let searchFn;
      if (src === 'huggingface') {
        searchFn = searchHuggingFace(q, type, maxPerSource);
      } else if (src === 'kaggle') {
        searchFn = searchKaggle(q, type, maxPerSource);
      } else {
        searchFn = searchGitHub(q, type, maxPerSource);
      }
      
      return Promise.race([searchFn, timeout])
        .catch(e => ({
          source: src,
          results: [],
          error: e.message
        }));
    });

    const allResults = await Promise.all(searchPromises);

    // Combine results
    const combined = allResults.flatMap(r => r.results || []);

    // Final re-ranking by relevance score
    combined.sort((a, b) =>
      (b.relevanceScore || 0) - 
      (a.relevanceScore || 0)
    );

    const sourceStats = allResults.map(r => ({
      name: r.source,
      count: (r.results || []).length,
      error: r.error || null
    }));

    console.log(
      `Results: ${combined.length} total - ` +
      sourceStats.map(s => `${s.count} from ${s.name}`).join(', ')
    );

    return res.json({
      query: q,
      type,
      total: combined.length,
      sources: sourceStats,
      results: combined
    });

  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({
      error: 'Search failed: ' + err.message
    });
  }
});

module.exports = router;

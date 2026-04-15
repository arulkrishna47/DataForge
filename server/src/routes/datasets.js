const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');

if (typeof protect !== 'function') {
  throw new Error('protect middleware is not a function - check /middleware/authMiddleware.js export');
}

// GET /api/datasets/search
router.get('/search', protect, async (req, res) => {
  try {
    const { 
      query, 
      type = 'all',
      source = 'all',
      limit = '10'
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters' 
      });
    }

    const maxResults = Math.min(parseInt(limit) || 10, 20);
    const sources = source === 'all' 
      ? ['kaggle', 'huggingface', 'github']
      : [source];

    // Run all searches in parallel
    const searchPromises = [];
    
    if (sources.includes('huggingface')) {
      searchPromises.push(
        searchHuggingFace(query, type, maxResults)
          .catch(e => ({ 
            source: 'huggingface', 
            results: [], 
            error: e.message 
          }))
      );
    }
    
    if (sources.includes('kaggle')) {
      searchPromises.push(
        searchKaggle(query, type, maxResults)
          .catch(e => ({ 
            source: 'kaggle', 
            results: [], 
            error: e.message 
          }))
      );
    }
    
    if (sources.includes('github')) {
      searchPromises.push(
        searchGitHub(query, type, maxResults)
          .catch(e => ({ 
            source: 'github', 
            results: [], 
            error: e.message 
          }))
      );
    }

    const allResults = await Promise.all(searchPromises);
    
    // Combine and flatten results
    const combined = allResults.flatMap(r => r.results || []);

    return res.json({
      query,
      type,
      total: combined.length,
      sources: allResults.map(r => ({
        name: r.source,
        count: (r.results || []).length,
        error: r.error || null
      })),
      results: combined
    });

  } catch (err) {
    return res.status(500).json({ 
      error: err.message || 'Search failed' 
    });
  }
});

/**
 * HUGGING FACE SEARCH
 */
async function searchHuggingFace(query, type, limit) {
  const tagMap = {
    'image': 'image-classification',
    'text': 'text-classification', 
    'audio': 'audio-classification',
    'video': 'video-classification',
    'object-detection': 'object-detection',
    'nlp': 'text-generation',
    'tabular': 'tabular-classification',
  };
  
  const tag = tagMap[type] || '';
  const url = new URL('https://huggingface.co/api/datasets');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('full', 'false');
  if (tag) url.searchParams.set('filter', tag);
  url.searchParams.set('sort', 'downloads');
  url.searchParams.set('direction', '-1');
  
  const hfToken = process.env.HF_TOKEN || '';
  const headers = { 'Accept': 'application/json' };
  if (hfToken) {
    headers['Authorization'] = `Bearer ${hfToken}`;
  }
  
  const response = await axios.get(url.toString(), { headers, timeout: 10000 });
  const datasets = response.data || [];
  
  return {
    source: 'huggingface',
    results: datasets.slice(0, limit).map(d => ({
      id: d.id || d._id,
      title: d.id || 'Unnamed Dataset',
      description: d.description || d.cardData?.description || 'No description available',
      source: 'huggingface',
      sourceLabel: 'Hugging Face',
      sourceLogo: '🤗',
      url: `https://huggingface.co/datasets/${d.id}`,
      downloads: d.downloads || 0,
      likes: d.likes || 0,
      tags: d.tags || [],
      size: d.cardData?.dataset_info?.dataset_size || null,
      license: d.cardData?.license || 'Unknown',
      lastModified: d.lastModified || null,
      type: detectDatasetType(d.tags || []),
      previewUrl: `https://huggingface.co/datasets/${d.id}`,
    }))
  };
}

/**
 * KAGGLE SEARCH
 */
async function searchKaggle(query, type, limit) {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  
  if (!username || !key) {
    return {
      source: 'kaggle',
      results: [],
      error: 'Kaggle API credentials not configured.'
    };
  }
  
  const credentials = Buffer.from(`${username}:${key}`).toString('base64');
  const url = new URL('https://www.kaggle.com/api/v1/datasets/list');
  url.searchParams.set('search', query);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('sortBy', 'hottest');
  
  const fileTypeMap = {
    'image': 'png',
    'text': 'csv',
    'tabular': 'csv',
    'audio': 'other',
    'video': 'other',
  };
  if (fileTypeMap[type]) {
    url.searchParams.set('fileType', fileTypeMap[type]);
  }
  
  const response = await axios.get(url.toString(), {
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json'
    },
    timeout: 10000
  });
  
  const datasets = response.data || [];
  
  return {
    source: 'kaggle',
    results: datasets.slice(0, limit).map(d => ({
      id: `${d.ownerRef}/${d.datasetSlug}`,
      title: d.title || d.datasetSlug,
      description: d.subtitle || d.description || 'No description available',
      source: 'kaggle',
      sourceLabel: 'Kaggle',
      sourceLogo: '📊',
      url: `https://www.kaggle.com/datasets/${d.ownerRef}/${d.datasetSlug}`,
      downloads: d.downloadCount || 0,
      likes: d.voteCount || 0,
      tags: d.tags?.map(t => t.name) || [],
      size: formatBytes(d.totalBytes),
      license: d.licenseName || 'Unknown',
      lastModified: d.lastUpdated || null,
      author: d.ownerName || d.ownerRef,
      usabilityRating: d.usabilityRating,
      type: type || 'general',
      previewUrl: `https://www.kaggle.com/datasets/${d.ownerRef}/${d.datasetSlug}`,
    }))
  };
}

/**
 * GITHUB SEARCH
 */
async function searchGitHub(query, type, limit) {
  const token = process.env.GITHUB_TOKEN || '';
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Cortexa-App'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const typeTerms = {
    'image': 'image classification dataset',
    'text': 'nlp text dataset',
    'audio': 'audio speech dataset',
    'video': 'video dataset',
    'object-detection': 'object detection dataset',
    'tabular': 'tabular csv dataset',
  };
  
  const searchTerm = `${query} ${typeTerms[type] || 'dataset'} in:name,description,readme`;
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', searchTerm);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(limit));
  
  const response = await axios.get(url.toString(), { headers, timeout: 10000 });
  const repos = response.data?.items || [];
  
  return {
    source: 'github',
    results: repos.slice(0, limit).map(r => ({
      id: r.full_name,
      title: r.name,
      description: r.description || 'No description available',
      source: 'github',
      sourceLabel: 'GitHub',
      sourceLogo: '🐙',
      url: r.html_url,
      downloads: r.forks_count || 0,
      likes: r.stargazers_count || 0,
      tags: r.topics || [],
      size: r.size ? `${Math.round(r.size / 1024)} MB` : 'Unknown',
      license: r.license?.name || 'Unknown',
      lastModified: r.updated_at,
      author: r.owner?.login,
      language: r.language,
      type: type || 'general',
      previewUrl: r.html_url,
    }))
  };
}

function detectDatasetType(tags) {
  const tagStr = (tags || []).join(' ').toLowerCase();
  if (tagStr.includes('image')) return 'image';
  if (tagStr.includes('audio') || tagStr.includes('speech')) return 'audio';
  if (tagStr.includes('video')) return 'video';
  if (tagStr.includes('text') || tagStr.includes('nlp')) return 'text';
  if (tagStr.includes('tabular')) return 'tabular';
  return 'general';
}

function formatBytes(bytes) {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  return `${(bytes/(1024*1024*1024)).toFixed(1)} GB`;
}

module.exports = router;

const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const proxyManager = require('./proxy-manager');

const USE_PROXY = process.env.USE_PROXY === 'true';
const MAX_RETRIES = 3;

const app = express();
app.use(express.json());
app.use(express.static('public'));

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'YouTube Downloader API',
    version: '1.0.0',
    description: 'API for fetching YouTube video information and download links in various qualities'
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/info': {
      get: {
        summary: 'Get video information and available formats',
        parameters: [{
          name: 'url',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'YouTube video URL'
        }],
        responses: {
          '200': {
            description: 'Video information with available formats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    thumbnail: { type: 'string' },
                    duration: { type: 'string' },
                    channel: { type: 'string' },
                    view_count: { type: 'integer' },
                    video_formats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          format_id: { type: 'string' },
                          ext: { type: 'string' },
                          resolution: { type: 'string' },
                          filesize: { type: 'string' }
                        }
                      }
                    },
                    audio_formats: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          format_id: { type: 'string' },
                          ext: { type: 'string' },
                          bitrate: { type: 'string' },
                          filesize: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Missing URL parameter' },
          '500': { description: 'Error fetching video info' }
        }
      }
    },
    '/api/download': {
      get: {
        summary: 'Get direct download URL for a specific format',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'YouTube video URL'
          },
          {
            name: 'format_id',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Format ID from /api/info response'
          }
        ],
        responses: {
          '200': {
            description: 'Download URLs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    download_urls: { 
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Array of direct download URLs (video and audio streams)'
                    },
                    format_id: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { description: 'Missing required parameters' },
          '500': { description: 'Error getting download URL' }
        }
      }
    },
    '/api/proxy-status': {
      get: {
        summary: 'Get current proxy status',
        responses: {
          '200': {
            description: 'Proxy status information'
          }
        }
      }
    }
  }
};

async function executeWithProxy(command, url) {
  if (!USE_PROXY) {
    console.log(`Executing without proxy: ${url}`);
    return execSync(command, { encoding: 'utf-8', timeout: 120000 });
  }

  if (proxyManager.workingProxies.length < 2) {
    console.log('Finding working proxies...');
    await proxyManager.findWorkingProxies(5);
  }

  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { arg: proxyArg, proxy } = proxyManager.getProxyArg();
    
    if (!proxyArg) {
      console.log('No proxies available, trying without proxy...');
      try {
        return execSync(command, { encoding: 'utf-8', timeout: 120000 });
      } catch (error) {
        lastError = error;
        break;
      }
    }

    const cmdWithProxy = command.replace('yt-dlp', `yt-dlp ${proxyArg}`);
    console.log(`Attempt ${attempt + 1}/${MAX_RETRIES} with proxy ${proxy}: ${url}`);

    try {
      const result = execSync(cmdWithProxy, { encoding: 'utf-8', timeout: 60000 });
      console.log(`Success with proxy ${proxy}`);
      return result;
    } catch (error) {
      console.log(`Proxy ${proxy} failed: ${error.message}`);
      proxyManager.markProxyBad(proxy);
      lastError = error;
      
      if (proxyManager.workingProxies.length < 2) {
        await proxyManager.findWorkingProxies(5);
      }
    }
  }

  console.log('All proxies failed, trying without proxy...');
  try {
    return execSync(command, { encoding: 'utf-8', timeout: 120000 });
  } catch (error) {
    throw lastError || error;
  }
}

app.get('/api/docs', (req, res) => {
  res.json(openApiSpec);
});

app.get('/api/proxy-status', (req, res) => {
  res.json({
    enabled: USE_PROXY,
    workingProxies: proxyManager.workingProxies.length,
    totalProxies: proxyManager.proxies.length,
    lastFetch: proxyManager.lastFetch ? new Date(proxyManager.lastFetch).toISOString() : null
  });
});

app.post('/api/refresh-proxies', async (req, res) => {
  try {
    await proxyManager.findWorkingProxies(10);
    res.json({
      success: true,
      workingProxies: proxyManager.workingProxies.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const cmd = `yt-dlp --dump-json "${url}" 2>/dev/null`;
    const output = await executeWithProxy(cmd, url);
    const info = JSON.parse(output);

    const defaultVideoFormats = [
      { format_id: 'best[ext=mp4]', ext: 'mp4', resolution: 'Best Quality', filesize: 'Auto' },
      { format_id: 'bestvideo[height<=1080]+bestaudio/best', ext: 'mp4', resolution: '1080p', filesize: 'Auto' },
      { format_id: 'bestvideo[height<=720]+bestaudio/best', ext: 'mp4', resolution: '720p', filesize: 'Auto' },
      { format_id: 'bestvideo[height<=480]+bestaudio/best', ext: 'mp4', resolution: '480p', filesize: 'Auto' },
      { format_id: 'bestvideo[height<=360]+bestaudio/best', ext: 'mp4', resolution: '360p', filesize: 'Auto' }
    ];

    const defaultAudioFormats = [
      { format_id: 'bestaudio[ext=m4a]/bestaudio', ext: 'm4a', bitrate: 'Best', filesize: 'Auto' },
      { format_id: 'bestaudio', ext: 'auto', bitrate: 'Best Available', filesize: 'Auto' }
    ];

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration_string || `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`,
      channel: info.channel,
      view_count: info.view_count,
      video_formats: defaultVideoFormats,
      audio_formats: defaultAudioFormats
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
  }
});

app.get('/api/download', async (req, res) => {
  const { url, format_id } = req.query;
  if (!url || !format_id) {
    return res.status(400).json({ error: 'URL and format_id parameters are required' });
  }

  try {
    const infoCmd = `yt-dlp --dump-json "${url}" 2>/dev/null`;
    const infoOutput = await executeWithProxy(infoCmd, url);
    const info = JSON.parse(infoOutput);

    const urlCmd = `yt-dlp -f "${format_id}" --get-url "${url}" 2>/dev/null`;
    const downloadUrl = await executeWithProxy(urlCmd, url);

    const urls = downloadUrl.trim().split('\n').filter(u => u.trim());

    res.json({
      title: info.title,
      download_urls: urls,
      format_id: format_id
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to get download URL', details: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs available at /api/docs`);
  console.log(`Proxy system: ${USE_PROXY ? 'ENABLED' : 'DISABLED'}`);
  
  if (USE_PROXY) {
    console.log('Initializing proxy pool...');
    await proxyManager.findWorkingProxies(5);
  }
});

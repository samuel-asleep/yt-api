const express = require('express');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROXY_URL = process.env.PROXY_URL || '';

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
    }
  }
};

app.get('/api/docs', (req, res) => {
  res.json(openApiSpec);
});

app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const proxyArg = PROXY_URL ? `--proxy "${PROXY_URL}"` : '';
    const cmd = `yt-dlp ${proxyArg} --dump-json "${url}" 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
    const info = JSON.parse(output);

    const videoFormats = [];
    const audioFormats = [];

    for (const format of info.formats || []) {
      if (format.vcodec && format.vcodec !== 'none' && format.acodec !== 'none') {
        videoFormats.push({
          format_id: format.format_id,
          ext: format.ext,
          resolution: format.resolution || `${format.width}x${format.height}`,
          filesize: format.filesize ? `${(format.filesize / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
          vcodec: format.vcodec,
          acodec: format.acodec
        });
      } else if (format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none')) {
        audioFormats.push({
          format_id: format.format_id,
          ext: format.ext,
          bitrate: format.abr ? `${format.abr}kbps` : 'Unknown',
          filesize: format.filesize ? `${(format.filesize / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
          acodec: format.acodec
        });
      }
    }

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
    const proxyArg = PROXY_URL ? `--proxy "${PROXY_URL}"` : '';
    const infoCmd = `yt-dlp ${proxyArg} --dump-json "${url}" 2>/dev/null`;
    const infoOutput = execSync(infoCmd, { encoding: 'utf-8', timeout: 60000 });
    const info = JSON.parse(infoOutput);

    const urlCmd = `yt-dlp ${proxyArg} -f "${format_id}" --get-url "${url}" 2>/dev/null`;
    const downloadUrl = execSync(urlCmd, { encoding: 'utf-8', timeout: 60000 }).trim();

    const urls = downloadUrl.split('\n').filter(u => u.trim());

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API docs available at /api/docs`);
});

const https = require('https');
const http = require('http');

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.workingProxies = [];
    this.currentIndex = 0;
    this.lastFetch = 0;
    this.fetchInterval = 10 * 60 * 1000;
    this.isEnabled = process.env.USE_PROXY === 'true';
  }

  async fetchProxies() {
    const sources = [
      'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'
    ];

    const allProxies = [];

    for (const source of sources) {
      try {
        const data = await this.httpGet(source);
        const proxies = data.split('\n')
          .map(line => line.trim())
          .filter(line => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(line));
        allProxies.push(...proxies);
        console.log(`Fetched ${proxies.length} proxies from source`);
      } catch (error) {
        console.log(`Failed to fetch from source: ${error.message}`);
      }
    }

    this.proxies = [...new Set(allProxies)];
    this.lastFetch = Date.now();
    console.log(`Total unique proxies: ${this.proxies.length}`);
    return this.proxies;
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = client.get(url, { timeout: 15000 }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async testProxy(proxy) {
    return new Promise((resolve) => {
      const [host, port] = proxy.split(':');
      const testUrl = 'http://www.google.com';
      
      const options = {
        host: host,
        port: parseInt(port),
        method: 'CONNECT',
        path: 'www.google.com:80',
        timeout: 8000
      };

      const req = http.request(options);
      
      req.on('connect', (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
        req.destroy();
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  async testProxyWithCurl(proxy) {
    const { execSync } = require('child_process');
    try {
      execSync(`curl -x http://${proxy} -s --connect-timeout 5 --max-time 10 http://www.google.com -o /dev/null`, {
        timeout: 12000
      });
      return true;
    } catch {
      return false;
    }
  }

  async findWorkingProxies(count = 5) {
    if (!this.isEnabled) {
      console.log('Proxy system disabled');
      return [];
    }

    if (Date.now() - this.lastFetch > this.fetchInterval || this.proxies.length === 0) {
      await this.fetchProxies();
    }

    console.log(`Testing proxies to find ${count} working ones...`);
    this.workingProxies = [];
    
    const shuffled = [...this.proxies].sort(() => Math.random() - 0.5);
    const toTest = shuffled.slice(0, 100);

    for (const proxy of toTest) {
      if (this.workingProxies.length >= count) break;
      
      const works = await this.testProxyWithCurl(proxy);
      if (works) {
        this.workingProxies.push(proxy);
        console.log(`Found working proxy: ${proxy}`);
      }
    }

    console.log(`Found ${this.workingProxies.length} working proxies`);
    return this.workingProxies;
  }

  getNextProxy() {
    if (this.workingProxies.length === 0) {
      return null;
    }
    const proxy = this.workingProxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.workingProxies.length;
    return proxy;
  }

  markProxyBad(proxy) {
    const index = this.workingProxies.indexOf(proxy);
    if (index > -1) {
      this.workingProxies.splice(index, 1);
      console.log(`Removed bad proxy: ${proxy}. ${this.workingProxies.length} proxies remaining`);
    }
  }

  getProxyArg() {
    const proxy = this.getNextProxy();
    if (proxy) {
      return { arg: `--proxy "http://${proxy}"`, proxy };
    }
    return { arg: '', proxy: null };
  }
}

module.exports = new ProxyManager();

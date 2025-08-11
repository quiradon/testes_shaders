// Utilitários de exportação
class ExportUtils {
  constructor() {
    this.isExporting = false;
    
    this.elements = {
      downloadGifBtn: document.getElementById('downloadGif'),
      downloadWebMBtn: document.getElementById('downloadWebM'),
      canvas: document.getElementById('canvas'),
      loadingIndicator: document.getElementById('loading'),
      loadingText: document.getElementById('loadingText'),
      exportBtn: document.getElementById('exportBtn')
    };
    
    this.initializeEvents();
  }

  initializeEvents() {
    this.elements.downloadGifBtn.addEventListener('click', () => {
      this.handleDownload('gif');
    });
    
    this.elements.downloadWebMBtn.addEventListener('click', () => {
      this.handleDownload('webm');
    });
  }

  showLoading(isShowing, format) {
    if (isShowing) {
      this.elements.loadingText.textContent = `Gerando ${format ? format.toUpperCase() : 'arquivo'}...`;
      this.elements.canvas.classList.add('d-none');
      document.getElementById('overlay').classList.add('d-none');
      this.elements.loadingIndicator.classList.remove('d-none');
      this.elements.loadingIndicator.classList.add('d-flex');
      this.elements.exportBtn.disabled = true;
      this.isExporting = true;
    } else {
      this.elements.loadingIndicator.classList.add('d-none');
      this.elements.loadingIndicator.classList.remove('d-flex');
      if (window.userImage) {
        this.elements.canvas.classList.remove('d-none');
        document.getElementById('overlay').classList.remove('d-none');
        this.elements.exportBtn.disabled = false;
      }
      this.isExporting = false;
    }
  }

  async handleDownload(format) {
    if (!window.userImage) return;
    if (this.isExporting) return;

    this.showLoading(true, format);

    try {
      const frameRate = 20;
      const frameDuration = 1000 / frameRate;
      const angularFrequency = 2.5;
      const animationPeriod = (2 * Math.PI) / angularFrequency;
      const animationDuration = animationPeriod * 1000;

      if (format === 'gif') {
        await this.exportAsGIF(frameRate, frameDuration, animationDuration);
      } else if (format === 'webm') {
        await this.exportAsWebM(frameRate, animationDuration);
      }
    } catch (error) {
      console.error('Export error:', error);
      effectsManager.showNotification(`Erro ao exportar ${format.toUpperCase()}: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async exportAsGIF(frameRate, frameDuration, animationDuration) {
    const totalFrames = Math.round(animationDuration / frameDuration);
    let workerUrl;

    try {
      // Tentar carregar o worker script
      const workerResponse = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
      const workerScript = await workerResponse.text();
      const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(workerBlob);
    } catch {
      throw new Error('Não foi possível carregar os recursos para criar o GIF.');
    }

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      transparent: 0x00000000
    });

    // Parar animação atual
    if (webglRenderer.animationFrameId) {
      cancelAnimationFrame(webglRenderer.animationFrameId);
      webglRenderer.animationFrameId = null;
    }

    // Capturar frames
    for (let i = 0; i < totalFrames; i++) {
      const timeForFrame = (i * frameDuration);
      webglRenderer.animate(timeForFrame);
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.elements.canvas.width;
      tempCanvas.height = this.elements.canvas.height;
      tempCanvas.getContext('2d').drawImage(this.elements.canvas, 0, 0);
      
      gif.addFrame(tempCanvas, { copy: true, delay: frameDuration });
      
      // Atualizar progresso
      const progress = Math.round((i / totalFrames) * 50); // 50% para captura
      this.elements.loadingText.textContent = `Capturando frames... ${progress}%`;
    }

    return new Promise((resolve, reject) => {
      gif.on('progress', (progress) => {
        const totalProgress = 50 + Math.round(progress * 50); // 50% para renderização
        this.elements.loadingText.textContent = `Renderizando GIF... ${totalProgress}%`;
      });

      gif.on('finished', (blob) => {
        this.downloadBlob(blob, 'token-animado.gif');
        URL.revokeObjectURL(workerUrl);
        
        // Reiniciar animação
        if (!webglRenderer.animationFrameId) {
          webglRenderer.animate(0);
        }
        
        effectsManager.showNotification('GIF exportado com sucesso!', 'success');
        resolve();
      });

      gif.on('abort', () => {
        URL.revokeObjectURL(workerUrl);
        reject(new Error('Exportação cancelada'));
      });

      gif.render();
    });
  }

  async exportAsWebM(frameRate, animationDuration) {
    if (!this.elements.canvas.captureStream) {
      throw new Error('Seu navegador não suporta captura de stream do canvas');
    }

    const chunks = [];
    const stream = this.elements.canvas.captureStream(frameRate);
    
    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm; codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        this.downloadBlob(blob, 'token-animado.webm');
        effectsManager.showNotification('Vídeo WebM exportado com sucesso!', 'success');
        resolve();
      };

      recorder.onerror = (e) => {
        reject(new Error(`Erro na gravação: ${e.error}`));
      };

      recorder.start();
      
      // Atualizar progresso
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 2;
        if (progress >= 100) {
          clearInterval(progressInterval);
          this.elements.loadingText.textContent = 'Finalizando vídeo...';
        } else {
          this.elements.loadingText.textContent = `Gravando vídeo... ${progress}%`;
        }
      }, animationDuration / 50);

      setTimeout(() => {
        clearInterval(progressInterval);
        recorder.stop();
      }, animationDuration + 500); // Pequena margem
    });
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Verificar se o navegador suporta exportação
  static checkBrowserSupport() {
    const support = {
      gif: typeof GIF !== 'undefined',
      webm: typeof MediaRecorder !== 'undefined' && 
            document.createElement('canvas').captureStream !== undefined
    };
    
    return support;
  }

  // Métodos públicos
  enableExport() {
    this.elements.exportBtn.disabled = false;
  }

  disableExport() {
    this.elements.exportBtn.disabled = true;
  }

  isCurrentlyExporting() {
    return this.isExporting;
  }
}

// Criar instância global
const exportUtils = new ExportUtils();

// Verificar suporte do navegador na inicialização
document.addEventListener('DOMContentLoaded', () => {
  const support = ExportUtils.checkBrowserSupport();
  
  if (!support.gif) {
    document.getElementById('downloadGif').classList.add('disabled');
    document.getElementById('downloadGif').title = 'GIF.js não está disponível';
  }
  
  if (!support.webm) {
    document.getElementById('downloadWebM').classList.add('disabled');
    document.getElementById('downloadWebM').title = 'Seu navegador não suporta gravação de vídeo';
  }
});

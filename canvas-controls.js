// Controles de canvas e navegação aprimorados
class CanvasControls {
  constructor() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;
    this.panMode = false;
    
    this.elements = {
      zoomOutBtn: document.getElementById('zoomOutBtn'),
      zoomInBtn: document.getElementById('zoomInBtn'),
      zoomDisplay: document.getElementById('zoomDisplay'),
      fitBtn: document.getElementById('fitBtn'),
      panBtn: document.getElementById('panBtn'),
      centerBtn: document.getElementById('centerBtn'),
      scrollArea: document.getElementById('scrollArea'),
      stage: document.getElementById('stage'),
      canvas: document.getElementById('canvas'),
      overlay: document.getElementById('overlay'),
      canvasControls: document.getElementById('canvasControls'),
      zoomControls: document.getElementById('zoomControls')
    };
    
    this.initializeEvents();
    this.createZoomIndicator();
  }

  initializeEvents() {
    // Zoom controls
    this.elements.zoomInBtn.addEventListener('click', () => {
      this.setZoom(Math.min(10, this.zoom + 0.2));
      this.centerCanvas();
    });

    this.elements.zoomOutBtn.addEventListener('click', () => {
      this.setZoom(Math.max(0.1, this.zoom - 0.2));
      this.centerCanvas();
    });

    this.elements.fitBtn.addEventListener('click', () => {
      this.fitToArea();
    });

    this.elements.centerBtn.addEventListener('click', () => {
      this.centerCanvas();
    });

    this.elements.panBtn.addEventListener('click', () => {
      this.togglePanMode();
    });

    // Mouse wheel zoom
    this.elements.scrollArea.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const rect = this.elements.scrollArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomDelta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        this.zoomAtPoint(mouseX, mouseY, zoomDelta);
      }
    });

    // Pan functionality
    this.elements.scrollArea.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this.panMode) { // Middle mouse button or pan mode
        e.preventDefault();
        this.startPan(e.clientX, e.clientY);
      }
    });

    this.elements.scrollArea.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.updatePan(e.clientX, e.clientY);
      }
    });

    this.elements.scrollArea.addEventListener('mouseup', (e) => {
      if (e.button === 1 || this.panMode) {
        this.endPan();
      }
    });

    this.elements.scrollArea.addEventListener('mouseleave', () => {
      this.endPan();
    });

    // Double click to reset zoom and center
    this.elements.scrollArea.addEventListener('dblclick', (e) => {
      if (!this.panMode) {
        this.setZoom(1);
        this.centerCanvas();
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch(e.key) {
        case ' ': // Space bar for pan mode
          e.preventDefault();
          if (!this.panMode) {
            this.togglePanMode();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.setZoom(1);
            this.centerCanvas();
          }
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.setZoom(Math.min(10, this.zoom + 0.2));
            this.centerCanvas();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.setZoom(Math.max(0.1, this.zoom - 0.2));
            this.centerCanvas();
          }
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        if (this.panMode) {
          this.togglePanMode();
        }
      }
    });

    // Prevent context menu on middle click
    this.elements.scrollArea.addEventListener('contextmenu', (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    });
  }

  createZoomIndicator() {
    // Removido - agora usamos o display integrado nos controles
  }

  setZoom(newZoom) {
    if (!this.elements.canvas.width) return;
    
    this.zoom = Math.max(0.1, Math.min(10, newZoom));
    
    // Update UI
    this.elements.zoomDisplay.textContent = Math.round(this.zoom * 100) + '%';
    
    // Apply zoom to canvas
    const width = Math.round(this.elements.canvas.width * this.zoom);
    const height = Math.round(this.elements.canvas.height * this.zoom);
    
    this.elements.canvas.style.width = width + 'px';
    this.elements.canvas.style.height = height + 'px';
    this.elements.overlay.style.width = width + 'px';
    this.elements.overlay.style.height = height + 'px';
    this.elements.stage.style.width = width + 'px';
    this.elements.stage.style.height = height + 'px';
  }

  zoomAtPoint(mouseX, mouseY, zoomDelta) {
    const oldZoom = this.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom + zoomDelta));
    
    if (newZoom === oldZoom) return;
    
    // Calculate zoom center point
    const scrollLeft = this.elements.scrollArea.scrollLeft;
    const scrollTop = this.elements.scrollArea.scrollTop;
    
    const zoomCenterX = (scrollLeft + mouseX) / oldZoom;
    const zoomCenterY = (scrollTop + mouseY) / oldZoom;
    
    this.setZoom(newZoom);
    
    // Adjust scroll position to keep zoom center in place
    const newScrollLeft = zoomCenterX * newZoom - mouseX;
    const newScrollTop = zoomCenterY * newZoom - mouseY;
    
    this.elements.scrollArea.scrollLeft = newScrollLeft;
    this.elements.scrollArea.scrollTop = newScrollTop;
  }

  fitToArea() {
    if (!this.elements.canvas.width) return;
    
    const padding = 32;
    const availableWidth = this.elements.scrollArea.clientWidth - padding;
    const availableHeight = this.elements.scrollArea.clientHeight - padding;
    
    const scaleX = availableWidth / this.elements.canvas.width;
    const scaleY = availableHeight / this.elements.canvas.height;
    const scale = Math.min(scaleX, scaleY);
    
    this.setZoom(Math.max(0.1, Math.min(10, scale)));
    this.centerCanvas();
  }

  centerCanvas() {
    if (!this.elements.canvas.width) return;
    
    const scrollAreaWidth = this.elements.scrollArea.clientWidth;
    const scrollAreaHeight = this.elements.scrollArea.clientHeight;
    const canvasWidth = this.elements.canvas.width * this.zoom;
    const canvasHeight = this.elements.canvas.height * this.zoom;
    
    const centerX = Math.max(0, (canvasWidth - scrollAreaWidth) / 2);
    const centerY = Math.max(0, (canvasHeight - scrollAreaHeight) / 2);
    
    this.elements.scrollArea.scrollLeft = centerX;
    this.elements.scrollArea.scrollTop = centerY;
  }

  togglePanMode() {
    this.panMode = !this.panMode;
    this.elements.panBtn.classList.toggle('active', this.panMode);
    
    if (this.panMode) {
      this.elements.scrollArea.classList.add('panning');
      this.elements.scrollArea.classList.remove('crosshair');
    } else {
      this.elements.scrollArea.classList.remove('panning');
      this.updateCursor();
    }
  }

  updateCursor() {
    if (window.settingPointForEffectId !== null || window.paintingEffectId !== null) {
      this.elements.scrollArea.classList.add('crosshair');
    } else {
      this.elements.scrollArea.classList.remove('crosshair');
    }
  }

  startPan(clientX, clientY) {
    this.isPanning = true;
    this.lastPanX = clientX;
    this.lastPanY = clientY;
    this.elements.scrollArea.classList.add('panning');
  }

  updatePan(clientX, clientY) {
    if (!this.isPanning) return;
    
    const deltaX = this.lastPanX - clientX;
    const deltaY = this.lastPanY - clientY;
    
    this.elements.scrollArea.scrollLeft += deltaX;
    this.elements.scrollArea.scrollTop += deltaY;
    
    this.lastPanX = clientX;
    this.lastPanY = clientY;
  }

  endPan() {
    this.isPanning = false;
    if (!this.panMode) {
      this.elements.scrollArea.classList.remove('panning');
      this.updateCursor();
    }
  }

  showControls() {
    this.elements.canvasControls.classList.remove('d-none');
    this.elements.zoomControls.classList.remove('d-none');
  }

  hideControls() {
    this.elements.canvasControls.classList.add('d-none');
    this.elements.zoomControls.classList.add('d-none');
  }

  // Método para ser chamado quando a imagem é carregada
  onImageLoaded() {
    this.showControls();
    this.fitToArea(); // Sempre ajustar ao tamanho e centralizar
  }

  // Método para ser chamado quando a aplicação é resetada
  onReset() {
    this.hideControls();
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.panMode = false;
    this.elements.panBtn.classList.remove('active');
    this.elements.scrollArea.classList.remove('panning', 'crosshair');
    this.elements.zoomDisplay.textContent = '100%';
  }
}

// Criar instância global
const canvasControls = new CanvasControls();

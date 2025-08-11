// Aplicação principal
class TokenAnimatorApp {
  constructor() {
    this.userImage = null;
    
    this.elements = {
      imageLoader: document.getElementById('imageLoader'),
      resetBtn: document.getElementById('resetBtn'),
      canvasContainer: document.getElementById('canvasContainer'),
      canvasPlaceholder: document.getElementById('canvasPlaceholder'),
      canvas: document.getElementById('canvas'),
      overlay: document.getElementById('overlay')
    };
    
    this.initializeEvents();
    this.setupDragAndDrop();
    
    // Inicializar UI
    effectsManager.renderEffectsUI();
  }

  initializeEvents() {
    // File input
    this.elements.imageLoader.addEventListener('change', (e) => {
      this.handleImageUploadEvent(e);
    });

    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.resetApplication();
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + O para abrir arquivo
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        this.elements.imageLoader.click();
      }
      
      // Ctrl/Cmd + R para resetar
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.resetApplication();
      }
    });
  }

  setupDragAndDrop() {
    // Drag and drop functionality
    this.elements.canvasContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.canvasContainer.classList.add('dragover');
    });

    this.elements.canvasContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.canvasContainer.classList.remove('dragover');
    });

    this.elements.canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.elements.canvasContainer.classList.remove('dragover');
      
      if (e.dataTransfer.files.length > 0) {
        // Carregar apenas a primeira imagem (sistema sem camadas)
        this.handleImageUploadEvent({ target: { files: e.dataTransfer.files } });
      }
    });
  }

  handleImageUploadEvent(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      effectsManager.showNotification('Por favor, selecione um arquivo de imagem válido.', 'error');
      return;
    }

    // Validar tamanho do arquivo (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      effectsManager.showNotification('Arquivo muito grande. Tamanho máximo: 10MB.', 'error');
      return;
    }

    // Carregar a imagem diretamente (sistema sem camadas)
    const reader = new FileReader();
    reader.onload = (event) => {
      this.loadImage(event.target.result);
    };
    
    reader.onerror = () => {
      effectsManager.showNotification('Erro ao ler o arquivo de imagem.', 'error');
    };
    
    reader.readAsDataURL(file);
  }

  loadImage(dataUrl) {
    this.userImage = new Image();
    
    this.userImage.onload = () => {
      // Validar dimensões da imagem
      const maxDimension = 4096;
      if (this.userImage.width > maxDimension || this.userImage.height > maxDimension) {
        effectsManager.showNotification(`Imagem muito grande. Dimensão máxima: ${maxDimension}px`, 'warning');
      }

      // Carregar imagem no renderer WebGL
      if (!webglRenderer.loadImage(this.userImage)) {
        effectsManager.showNotification('Erro ao inicializar WebGL.', 'error');
        return;
      }

      // Atualizar UI
      this.showCanvas();
      
      // Iniciar animação
      webglRenderer.startAnimation();
      
      // Configurar controles de canvas
      canvasControls.onImageLoaded();
      
      // Habilitar exportação
      exportUtils.enableExport();
      
      effectsManager.showNotification('Imagem carregada com sucesso!', 'success');
      
      // Limpar input
      this.elements.imageLoader.value = '';
    };

    this.userImage.onerror = () => {
      effectsManager.showNotification('Erro ao carregar a imagem.', 'error');
    };

    this.userImage.src = dataUrl;
  }

  resetApplication() {
    // Confirmar reset se houver efeitos ativos ou imagem carregada
    if (effectsManager.getActiveEffects().length > 0 || this.userImage) {
      if (!confirm('Tem certeza que deseja resetar? Todos os efeitos serão perdidos.')) {
        return;
      }
    }

    // Reset do renderer
    webglRenderer.reset();
    
    // Reset dos efeitos
    effectsManager.reset();
    
    // Reset dos controles de canvas
    canvasControls.onReset();
    
    // Reset da UI
    this.hideCanvas();
    exportUtils.disableExport();
    
    // Reset da aplicação
    this.userImage = null;
    this.elements.imageLoader.value = '';
    
    effectsManager.showNotification('Aplicação resetada!', 'info');
  }

  // Getters para acesso global
  get image() {
    return this.userImage;
  }

  get isImageLoaded() {
    return this.userImage !== null;
  }

  // Método público para mostrar canvas
  showCanvas() {
    this.elements.canvas.classList.remove('d-none');
    this.elements.overlay.classList.remove('d-none');
    this.elements.canvasPlaceholder.classList.add('d-none');
  }

  // Método público para esconder canvas
  hideCanvas() {
    this.elements.canvas.classList.add('d-none');
    this.elements.overlay.classList.add('d-none');
    this.elements.canvasPlaceholder.classList.remove('d-none');
  }
}

// Inicializar aplicação quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Criar instância global da aplicação
  window.app = new TokenAnimatorApp();
  
  // Expor userImage globalmente para compatibilidade
  Object.defineProperty(window, 'userImage', {
    get: () => window.app.image
  });
  
  // Mostrar informações do sistema no console
  console.log('🎭 Token Animator carregado!');
  console.log('💡 Dicas:');
  console.log('  • Ctrl/Cmd + O: Abrir imagem');
  console.log('  • Ctrl/Cmd + R: Resetar aplicação');
  console.log('  • Ctrl/Cmd + Scroll: Zoom');
  console.log('  • Espaço: Modo de navegação');
  console.log('  • [ / ]: Ajustar tamanho do pincel');
  console.log('  • Esc: Cancelar ação atual');
});

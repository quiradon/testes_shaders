// Gerenciador de Camadas
class LayerManager {
  constructor() {
    this.layers = [];
    this.selectedLayerId = null;
    this.nextLayerId = 1;
    
    this.elements = {
      layersList: document.getElementById('layersList'),
      noLayersText: document.getElementById('no-layers-text'),
      addLayerInput: document.getElementById('addLayerInput'),
      canvasPlaceholder: document.getElementById('canvasPlaceholder')
    };
    
    this.initializeEvents();
  }

  initializeEvents() {
    // Input para adicionar camadas
    this.elements.addLayerInput.addEventListener('change', (e) => {
      this.handleMultipleImages(e.target.files);
    });

    // Drag and drop para adicionar camadas
    document.getElementById('canvasContainer').addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('canvasContainer').classList.remove('dragover');
      
      if (e.dataTransfer.files.length > 0) {
        if (this.layers.length === 0) {
          // Primeira imagem - usar o sistema existente
          window.app.handleImageUploadEvent({ target: { files: e.dataTransfer.files } });
        } else {
          // Adicionar como novas camadas
          this.handleMultipleImages(e.dataTransfer.files);
        }
      }
    });
  }

  handleMultipleImages(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        this.addImageLayer(file);
      }
    });
  }

  addImageLayer(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const layer = {
          id: this.nextLayerId++,
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
          image: img,
          visible: true,
          opacity: 1.0,
          blendMode: 'normal',
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          originalWidth: img.width,
          originalHeight: img.height,
          effects: []  // Efeitos específicos desta camada
        };

        this.layers.push(layer);
        this.selectLayer(layer.id);
        this.renderLayersUI();
        this.updateCanvas();
        
        // Mostrar canvas se for a primeira camada
        if (this.layers.length === 1) {
          window.app.showCanvas();
          canvasControls.onImageLoaded();
          exportUtils.enableExport();
        }

        effectsManager.showNotification(`Camada "${layer.name}" adicionada!`, 'success');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  selectLayer(layerId) {
    this.selectedLayerId = layerId;
    this.renderLayersUI();
    // Atualizar os efeitos para a camada selecionada
    effectsManager.loadLayerEffects(this.getSelectedLayer());
  }

  getSelectedLayer() {
    return this.layers.find(layer => layer.id === this.selectedLayerId);
  }

  moveLayer(layerId, direction) {
    const index = this.layers.findIndex(layer => layer.id === layerId);
    if (index === -1) return;

    let newIndex;
    if (direction === 'up' && index < this.layers.length - 1) {
      newIndex = index + 1;
    } else if (direction === 'down' && index > 0) {
      newIndex = index - 1;
    } else {
      return;
    }

    // Trocar posições
    [this.layers[index], this.layers[newIndex]] = [this.layers[newIndex], this.layers[index]];
    
    this.renderLayersUI();
    this.updateCanvas();
  }

  duplicateSelectedLayer() {
    if (!this.selectedLayerId) return;

    const layer = this.getSelectedLayer();
    if (!layer) return;

    const duplicatedLayer = {
      ...layer,
      id: this.nextLayerId++,
      name: layer.name + ' (Cópia)',
      effects: layer.effects.map(effect => ({
        ...effect,
        id: Date.now() + Math.random() // Novo ID para os efeitos
      }))
    };

    // Inserir após a camada selecionada
    const index = this.layers.findIndex(l => l.id === this.selectedLayerId);
    this.layers.splice(index + 1, 0, duplicatedLayer);

    this.selectLayer(duplicatedLayer.id);
    this.renderLayersUI();
    this.updateCanvas();

    effectsManager.showNotification(`Camada "${duplicatedLayer.name}" criada!`, 'success');
  }

  deleteSelectedLayer() {
    if (!this.selectedLayerId || this.layers.length <= 1) {
      if (this.layers.length <= 1) {
        effectsManager.showNotification('Não é possível excluir a última camada!', 'warning');
      }
      return;
    }

    const layerName = this.getSelectedLayer()?.name;
    
    this.layers = this.layers.filter(layer => layer.id !== this.selectedLayerId);
    
    // Selecionar próxima camada disponível
    if (this.layers.length > 0) {
      this.selectedLayerId = this.layers[0].id;
    } else {
      this.selectedLayerId = null;
    }

    this.renderLayersUI();
    this.updateCanvas();

    effectsManager.showNotification(`Camada "${layerName}" excluída!`, 'info');
  }

  toggleLayerVisibility(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.renderLayersUI();
      this.updateCanvas();
    }
  }

  updateLayerOpacity(layerId, opacity) {
    console.log(`Atualizando opacidade da camada ${layerId} para ${opacity}`);
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      const newOpacity = Math.max(0, Math.min(1, parseFloat(opacity)));
      const oldOpacity = layer.opacity;
      layer.opacity = newOpacity;
      console.log(`Opacidade alterada de ${oldOpacity} para ${newOpacity}`);
      this.updateCanvas();
      
      // Forçar atualização do tooltip do slider
      setTimeout(() => {
        const slider = document.querySelector(`input[data-layer-id="${layerId}"][data-control="opacity"]`);
        if (slider) {
          slider.setAttribute('title', `Opacidade: ${Math.round(newOpacity * 100)}%`);
          slider.value = newOpacity;
        }
      }, 10);
    }
  }

  updateLayerBlendMode(layerId, blendMode) {
    console.log(`Atualizando blend mode da camada ${layerId} para ${blendMode}`);
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      layer.blendMode = blendMode;
      console.log(`Blend mode alterado para ${blendMode}`);
      this.updateCanvas();
      
      // Forçar atualização do select
      setTimeout(() => {
        const select = document.querySelector(`select[data-layer-id="${layerId}"][data-control="blendmode"]`);
        if (select) {
          select.value = blendMode;
        }
      }, 10);
    }
  }

  updateCanvas() {
    if (this.layers.length === 0) return;
    
    console.log('Atualizando canvas com', this.layers.length, 'camadas');

    // Determinar dimensões do canvas baseado na maior camada
    let maxWidth = 0, maxHeight = 0;
    this.layers.forEach(layer => {
      if (layer.visible) {
        maxWidth = Math.max(maxWidth, layer.width + layer.x);
        maxHeight = Math.max(maxHeight, layer.height + layer.y);
      }
    });

    // Atualizar tamanho do canvas
    const canvas = document.getElementById('canvas');
    const overlay = document.getElementById('overlay');
    
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    overlay.width = maxWidth;
    overlay.height = maxHeight;

    // Criar imagem composta
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = maxWidth;
    compositeCanvas.height = maxHeight;
    const ctx = compositeCanvas.getContext('2d');

    // Limpar canvas com transparência
    ctx.clearRect(0, 0, maxWidth, maxHeight);

    // Renderizar camadas com opacidade e blend modes corretos
    this.layers.forEach((layer, index) => {
      if (!layer.visible) {
        console.log(`Camada ${layer.name} (ID: ${layer.id}) não visível, pulando`);
        return;
      }

      console.log(`Renderizando camada ${layer.name} (ID: ${layer.id}) com opacidade ${layer.opacity} e blend mode ${layer.blendMode}`);

      ctx.save();
      
      // Aplicar opacidade - garantir que está entre 0 e 1
      const opacity = Math.max(0, Math.min(1, parseFloat(layer.opacity) || 1));
      ctx.globalAlpha = opacity;
      
      // Aplicar blend mode
      const blendMode = this.getCanvasBlendMode(layer.blendMode);
      ctx.globalCompositeOperation = blendMode;
      
      console.log(`Aplicando opacidade ${opacity} e blend mode ${blendMode}`);
      
      // Desenhar imagem da camada
      ctx.drawImage(
        layer.image,
        layer.x || 0,
        layer.y || 0,
        layer.width || layer.image.width,
        layer.height || layer.image.height
      );
      
      ctx.restore();
    });

    // Atualizar a imagem global
    const compositeImage = new Image();
    compositeImage.onload = () => {
      console.log('Imagem composta carregada com sucesso');
      // Substituir userImage global
      window.userImage = compositeImage;
      
      // Atualizar WebGL renderer apenas se há efeitos na camada selecionada
      const selectedLayer = this.getSelectedLayer();
      const hasEffects = selectedLayer && selectedLayer.effects && selectedLayer.effects.length > 0;
      
      if (hasEffects) {
        // Se há efeitos, usar WebGL com os efeitos da camada selecionada
        console.log('Há efeitos na camada selecionada, usando WebGL');
        if (webglRenderer.loadImage(compositeImage)) {
          webglRenderer.startAnimation();
        }
      } else {
        // Se não há efeitos, apenas mostrar a imagem composta
        console.log('Sem efeitos, mostrando imagem estática');
        if (webglRenderer.loadImage(compositeImage)) {
          webglRenderer.stopAnimation();
          // Desenhar imagem estática
          const ctx2d = canvas.getContext('2d');
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          ctx2d.drawImage(compositeImage, 0, 0);
        }
      }
      
      // Atualizar controles de canvas
      if (window.canvasControls) {
        canvasControls.setZoom(canvasControls.zoom);
      }
    };
    
    compositeImage.onerror = () => {
      console.error('Erro ao carregar imagem composta');
    };
    
    compositeImage.src = compositeCanvas.toDataURL('image/png');
  }

  getCanvasBlendMode(blendMode) {
    const blendModeMap = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'soft-light': 'soft-light',
      'hard-light': 'hard-light',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'darken': 'darken',
      'lighten': 'lighten',
      'difference': 'difference',
      'exclusion': 'exclusion'
    };
    return blendModeMap[blendMode] || 'source-over';
  }

  getBlendModeDisplayName(blendMode) {
    const displayNames = {
      'normal': 'Normal',
      'multiply': 'Multiplicar',
      'screen': 'Tela',
      'overlay': 'Sobreposição',
      'soft-light': 'Luz Suave',
      'hard-light': 'Luz Forte',
      'color-dodge': 'Subexposição',
      'color-burn': 'Superexposição',
      'darken': 'Escurecer',
      'lighten': 'Clarear',
      'difference': 'Diferença',
      'exclusion': 'Exclusão'
    };
    return displayNames[blendMode] || 'Normal';
  }

  renderLayersUI() {
    this.elements.noLayersText.classList.toggle('d-none', this.layers.length > 0);
    
    if (this.layers.length === 0) {
      this.elements.layersList.innerHTML = '<p id="no-layers-text" class="text-center text-body-secondary mt-4 mb-0">Nenhuma camada adicionada.</p>';
      return;
    }

    let html = '';
    
    // Renderizar camadas de cima para baixo (reverse order para UI)
    const reversedLayers = [...this.layers].reverse();
    
    reversedLayers.forEach((layer, index) => {
      const isSelected = layer.id === this.selectedLayerId;
      const isFirst = index === 0;
      const isLast = index === reversedLayers.length - 1;
      
      html += `
        <div class="layer-item ${isSelected ? 'selected' : ''}" onclick="layerManager.selectLayer(${layer.id})">
          <div class="d-flex align-items-center gap-2">
            <canvas class="layer-thumbnail" width="32" height="32" id="thumb-${layer.id}"></canvas>
            <div class="layer-info">
              <div class="layer-name" title="${layer.name}">${layer.name}</div>
              <div class="layer-size">${layer.originalWidth}×${layer.originalHeight}</div>
            </div>
            <div class="layer-controls">
              <button class="layer-visibility ${layer.visible ? 'visible' : ''}" 
                      onclick="event.stopPropagation(); layerManager.toggleLayerVisibility(${layer.id})"
                      title="${layer.visible ? 'Ocultar' : 'Mostrar'} camada">
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  ${layer.visible ? 
                    '<path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>' :
                    '<path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>'
                  }
                </svg>
              </button>
              <input type="range" class="layer-opacity-slider" 
                     min="0" max="1" step="0.01" value="${layer.opacity}"
                     data-layer-id="${layer.id}" data-control="opacity"
                     onclick="event.stopPropagation()"
                     oninput="layerManager.updateLayerOpacity(${layer.id}, this.value)"
                     title="Opacidade: ${Math.round(layer.opacity * 100)}%">
              <select class="layer-blend-mode" 
                      data-layer-id="${layer.id}" data-control="blendmode"
                      onclick="event.stopPropagation()"
                      onchange="layerManager.updateLayerBlendMode(${layer.id}, this.value)"
                      title="Modo de mistura: ${this.getBlendModeDisplayName(layer.blendMode)}">
                <option value="normal" ${layer.blendMode === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="multiply" ${layer.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
                <option value="screen" ${layer.blendMode === 'screen' ? 'selected' : ''}>Screen</option>
                <option value="overlay" ${layer.blendMode === 'overlay' ? 'selected' : ''}>Overlay</option>
                <option value="soft-light" ${layer.blendMode === 'soft-light' ? 'selected' : ''}>Soft Light</option>
                <option value="hard-light" ${layer.blendMode === 'hard-light' ? 'selected' : ''}>Hard Light</option>
                <option value="darken" ${layer.blendMode === 'darken' ? 'selected' : ''}>Darken</option>
                <option value="lighten" ${layer.blendMode === 'lighten' ? 'selected' : ''}>Lighten</option>
                <option value="difference" ${layer.blendMode === 'difference' ? 'selected' : ''}>Difference</option>
              </select>
            </div>
          </div>
          <div class="layer-move-controls mt-1" onclick="event.stopPropagation()">
            <div class="btn-group btn-group-sm w-100">
              <button class="btn btn-outline-secondary btn-sm ${isFirst ? 'disabled' : ''}" 
                      onclick="layerManager.moveLayer(${layer.id}, 'up')"
                      ${isFirst ? 'disabled' : ''}
                      title="Mover para cima">▲</button>
              <button class="btn btn-outline-secondary btn-sm ${isLast ? 'disabled' : ''}"
                      onclick="layerManager.moveLayer(${layer.id}, 'down')"
                      ${isLast ? 'disabled' : ''}
                      title="Mover para baixo">▼</button>
            </div>
          </div>
        </div>
      `;
    });
    
    this.elements.layersList.innerHTML = html;
    
    // Gerar thumbnails
    this.generateThumbnails();
  }

  generateThumbnails() {
    this.layers.forEach(layer => {
      const thumbnail = document.getElementById(`thumb-${layer.id}`);
      if (thumbnail && layer.image) {
        const ctx = thumbnail.getContext('2d');
        ctx.clearRect(0, 0, 32, 32);
        
        // Calcular aspect ratio para fit
        const aspectRatio = layer.image.width / layer.image.height;
        let drawWidth = 32, drawHeight = 32;
        
        if (aspectRatio > 1) {
          drawHeight = 32 / aspectRatio;
        } else {
          drawWidth = 32 * aspectRatio;
        }
        
        const offsetX = (32 - drawWidth) / 2;
        const offsetY = (32 - drawHeight) / 2;
        
        ctx.drawImage(layer.image, offsetX, offsetY, drawWidth, drawHeight);
      }
    });
  }

  // Métodos públicos para reset e acesso
  reset() {
    this.layers = [];
    this.selectedLayerId = null;
    this.nextLayerId = 1;
    this.renderLayersUI();
  }

  hasLayers() {
    return this.layers.length > 0;
  }

  getAllLayers() {
    return this.layers;
  }

  // Métodos para gerenciar efeitos por camada
  addEffectToSelectedLayer(effectType) {
    const layer = this.getSelectedLayer();
    if (!layer) return null;

    if (!layer.effects) {
      layer.effects = [];
    }

    const newEffect = effectsManager.createEffect(effectType);
    if (newEffect) {
      layer.effects.push(newEffect);
      this.updateCanvas();
      return newEffect;
    }
    return null;
  }

  removeEffectFromSelectedLayer(effectId) {
    const layer = this.getSelectedLayer();
    if (!layer || !layer.effects) return;

    layer.effects = layer.effects.filter(e => e.id !== effectId);
    this.updateCanvas();
  }

  getSelectedLayerEffects() {
    const layer = this.getSelectedLayer();
    return layer?.effects || [];
  }

  updateSelectedLayerEffect(effectId, property, value) {
    const layer = this.getSelectedLayer();
    if (!layer || !layer.effects) return;

    const effect = layer.effects.find(e => e.id === effectId);
    if (effect) {
      if (['strength', 'radius', 'softness', 'speed', 'phase', 'noiseScale', 'align', 'anchorHardness'].includes(property)) {
        effect[property] = parseFloat(value);
      } else if (property === 'windX') {
        if (!effect.wind) effect.wind = { x: 0, y: 0 };
        effect.wind.x = parseFloat(value);
      } else if (property === 'windY') {
        if (!effect.wind) effect.wind = { x: 0, y: 0 };
        effect.wind.y = parseFloat(value);
      } else {
        effect[property] = value;
      }
      this.updateCanvas();
    }
  }
}

// Criar instância global
const layerManager = new LayerManager();
